'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform, ROLE_LEVEL, type MembershipRole } from '@/lib/auth/permissions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffPath(slug: string) {
  return `/business/${slug}/staff`
}

const ROLE_LABELS: Record<MembershipRole, string> = {
  owner:           'Owner',
  admin:           'Admin',
  manager:         'Manager',
  cashier:         'Cashier',
  inventory_clerk: 'Inventory Clerk',
  staff:           'Staff',
}

/**
 * Returns true if the actor is allowed to assign the target role.
 * Owners can assign any role. Admins can only assign roles strictly below admin.
 */
function canAssignRole(actorRole: MembershipRole, targetRole: MembershipRole): boolean {
  if (actorRole === 'owner') return true
  return ROLE_LEVEL[targetRole] < ROLE_LEVEL[actorRole]
}

/**
 * Returns the count of active owner memberships for a business.
 * Used to prevent removal of the last owner.
 */
async function countActiveOwners(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string): Promise<number> {
  const { count } = await supabase
    .from('business_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('role', 'owner')
    .eq('status', 'active')
  return count ?? 0
}

/**
 * Writes a non-critical audit log entry via service role.
 * Failures are swallowed — audit logs must not block business operations.
 */
async function writeAudit(
  businessId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      business_id:   businessId,
      actor_user_id: actorId,
      action,
      target_type:   targetType,
      target_id:     targetId,
      metadata_json: metadata ?? null,
    })
  } catch {
    // intentionally swallowed
  }
}

// ── Exported types ────────────────────────────────────────────────────────────

export type StaffActionResult = { success: true } | { error: string }

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createInvitation(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    redirect(`${staffPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${staffPath(slug)}?error=Subscription+is+not+active`)
  }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  if (!email) {
    redirect(`/business/${slug}/staff/invite?error=Email+is+required`)
  }

  const roleRaw = formData.get('role') as string | null
  const role = roleRaw as MembershipRole | null
  if (!role || !ROLE_LABELS[role]) {
    redirect(`/business/${slug}/staff/invite?error=Invalid+role`)
  }

  if (!canAssignRole(ctx.membership.role, role)) {
    redirect(`/business/${slug}/staff/invite?error=You+cannot+assign+this+role`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if user is already a member
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    const { data: existingMembership } = await supabase
      .from('business_memberships')
      .select('id, status')
      .eq('business_id', ctx.business.id)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMembership && existingMembership.status === 'active') {
      redirect(`/business/${slug}/staff/invite?error=${encodeURIComponent('This user is already a member')}`)
    }
  }

  // Expire any existing pending invitation for this email at this business
  await supabase
    .from('business_invitations')
    .update({ status: 'expired' })
    .eq('business_id', ctx.business.id)
    .eq('email', email)
    .eq('status', 'pending')

  // Create the new invitation
  const { data: invitation, error } = await supabase
    .from('business_invitations')
    .insert({
      business_id:        ctx.business.id,
      email,
      role,
      invited_by_user_id: user.id,
    })
    .select('id, token')
    .single()

  if (error) {
    redirect(`/business/${slug}/staff/invite?error=${encodeURIComponent(error.message)}`)
  }

  await writeAudit(ctx.business.id, user.id, 'staff.invite', 'business_invitation', invitation.id, { email, role })

  revalidatePath(staffPath(slug))
  redirect(`${staffPath(slug)}?invited=${invitation.token}`)
}

export async function revokeInvitation(slug: string, invitationId: string): Promise<StaffActionResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('business_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('business_id', ctx.business.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  await writeAudit(ctx.business.id, user.id, 'staff.invite.revoke', 'business_invitation', invitationId)

  revalidatePath(staffPath(slug))
  return { success: true }
}

export async function updateMemberRole(
  slug: string,
  membershipId: string,
  newRole: MembershipRole
): Promise<StaffActionResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    return { error: 'Insufficient permissions' }
  }

  if (!ROLE_LABELS[newRole]) {
    return { error: 'Invalid role' }
  }

  if (!canAssignRole(ctx.membership.role, newRole)) {
    return { error: 'You cannot assign this role' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Load the target membership to validate
  const { data: target } = await supabase
    .from('business_memberships')
    .select('id, user_id, role, status')
    .eq('id', membershipId)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!target) return { error: 'Membership not found' }

  // Prevent self-modification
  if (target.user_id === user.id) {
    return { error: 'You cannot change your own role' }
  }

  // Prevent demoting the last active owner
  if (target.role === 'owner' && newRole !== 'owner') {
    const ownerCount = await countActiveOwners(supabase, ctx.business.id)
    if (ownerCount <= 1) {
      return { error: 'Cannot demote the last owner of this business' }
    }
  }

  // Prevent changing a role the actor cannot manage (can't manage up)
  if (!canAssignRole(ctx.membership.role, target.role as MembershipRole)) {
    return { error: 'You cannot manage this member\'s current role' }
  }

  const { error } = await supabase
    .from('business_memberships')
    .update({ role: newRole })
    .eq('id', membershipId)
    .eq('business_id', ctx.business.id)

  if (error) return { error: error.message }

  await writeAudit(ctx.business.id, user.id, 'staff.role.update', 'business_membership', membershipId, {
    from_role: target.role,
    to_role:   newRole,
  })

  revalidatePath(staffPath(slug))
  return { success: true }
}

export async function suspendMembership(slug: string, membershipId: string): Promise<StaffActionResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: target } = await supabase
    .from('business_memberships')
    .select('id, user_id, role, status')
    .eq('id', membershipId)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!target) return { error: 'Membership not found' }
  if (target.user_id === user.id) return { error: 'You cannot suspend yourself' }
  if (target.status !== 'active') return { error: 'Membership is not active' }

  if (!canAssignRole(ctx.membership.role, target.role as MembershipRole)) {
    return { error: 'You cannot manage this member\'s role' }
  }

  // Prevent suspending the last active owner
  if (target.role === 'owner') {
    const ownerCount = await countActiveOwners(supabase, ctx.business.id)
    if (ownerCount <= 1) {
      return { error: 'Cannot suspend the last owner of this business' }
    }
  }

  const { error } = await supabase
    .from('business_memberships')
    .update({ status: 'suspended' })
    .eq('id', membershipId)
    .eq('business_id', ctx.business.id)

  if (error) return { error: error.message }

  await writeAudit(ctx.business.id, user.id, 'staff.suspend', 'business_membership', membershipId)

  revalidatePath(staffPath(slug))
  return { success: true }
}

export async function reactivateMembership(slug: string, membershipId: string): Promise<StaffActionResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('business_memberships')
    .update({ status: 'active' })
    .eq('id', membershipId)
    .eq('business_id', ctx.business.id)
    .eq('status', 'suspended')

  if (error) return { error: error.message }

  await writeAudit(ctx.business.id, user.id, 'staff.reactivate', 'business_membership', membershipId)

  revalidatePath(staffPath(slug))
  return { success: true }
}
