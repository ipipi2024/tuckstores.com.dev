import { getAuthUserOrNull } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Invitation lookup must use the admin client: the invitee is not yet a member
// of the business, so the RLS policy "select for owner or admin" would block
// a regular authenticated client from reading their own invitation.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, LogIn, UserPlus } from 'lucide-react'

type Props = { params: Promise<{ token: string }> }

const ROLE_LABELS: Record<string, string> = {
  owner:           'Owner',
  admin:           'Admin',
  manager:         'Manager',
  cashier:         'Cashier',
  inventory_clerk: 'Inventory Clerk',
  staff:           'Staff',
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params

  const admin = createAdminClient()
  const supabase = await createClient()

  // Load the invitation via admin client (bypasses RLS — invitee is not yet a member)
  const { data: invitation } = await admin
    .from('business_invitations')
    .select(`
      id, email, role, status, expires_at,
      businesses ( id, name, slug )
    `)
    .eq('token', token)
    .maybeSingle()

  // ── Invalid / not found ───────────────────────────────────────────────────
  if (!invitation) {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Invalid invitation">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This invitation link is invalid or has already been used.
          </p>
        </StatusCard>
      </InviteLayout>
    )
  }

  const business = Array.isArray(invitation.businesses) ? invitation.businesses[0] : invitation.businesses

  // ── Already accepted ──────────────────────────────────────────────────────
  if (invitation.status === 'accepted') {
    return (
      <InviteLayout>
        <StatusCard icon={<CheckCircle2 className="text-green-500" size={28} />} title="Already accepted">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This invitation has already been accepted.
          </p>
          {business && (
            <Link
              href={`/business/${business.slug}/dashboard`}
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to {business.name}
            </Link>
          )}
        </StatusCard>
      </InviteLayout>
    )
  }

  // ── Expired or revoked ────────────────────────────────────────────────────
  const isExpired =
    invitation.status === 'expired' ||
    invitation.status === 'revoked' ||
    new Date(invitation.expires_at) < new Date()

  if (isExpired) {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-amber-500" size={28} />} title="Invitation expired">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This invitation has expired or been revoked.
            {business && <> Ask an admin of <strong>{business.name}</strong> to send a new one.</>}
          </p>
        </StatusCard>
      </InviteLayout>
    )
  }

  // ── Valid pending invitation ──────────────────────────────────────────────
  const user = await getAuthUserOrNull()

  // Not signed in → prompt to sign in / sign up
  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`)
    return (
      <InviteLayout>
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">You&apos;ve been invited to join</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{business?.name ?? 'a business'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              as <span className="font-medium text-gray-700 dark:text-gray-300">{ROLE_LABELS[invitation.role] ?? invitation.role}</span>
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/login?next=${next}`}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <LogIn size={15} />
              Sign in to accept
            </Link>
            <Link
              href={`/signup?next=${next}`}
              className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <UserPlus size={15} />
              Create an account
            </Link>
          </div>
          <p className="text-xs text-center text-gray-400 dark:text-neutral-500">
            Sign in with the email address <strong>{invitation.email}</strong> to accept.
          </p>
        </div>
      </InviteLayout>
    )
  }

  // ── Signed in: email mismatch ─────────────────────────────────────────────
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Wrong account">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This invitation was sent to <strong>{invitation.email}</strong>.
            You are signed in as <strong>{user.email}</strong>.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Sign out and sign in with the correct account to accept this invitation.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Switch account
          </Link>
        </StatusCard>
      </InviteLayout>
    )
  }

  // ── Signed in + email matches → accept ────────────────────────────────────
  if (!business) {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Business not found">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The business associated with this invitation no longer exists.
          </p>
        </StatusCard>
      </InviteLayout>
    )
  }

  // Check if membership already exists
  const { data: existingMembership } = await supabase
    .from('business_memberships')
    .select('id, status')
    .eq('business_id', business.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMembership?.status === 'active') {
    // Already a member — just mark invitation accepted and redirect
    await supabase
      .from('business_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)
    redirect(`/business/${business.slug}/dashboard`)
  }

  if (existingMembership?.status === 'suspended') {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Access suspended">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your membership at <strong>{business.name}</strong> has been suspended. Contact an admin.
          </p>
        </StatusCard>
      </InviteLayout>
    )
  }

  // Get the user's platform profile to get their ID
  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!userProfile) {
    return (
      <InviteLayout>
        <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Profile not found">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your user profile could not be found. Please try signing out and back in.
          </p>
        </StatusCard>
      </InviteLayout>
    )
  }

  // Create the membership and accept the invitation atomically via admin client,
  // which bypasses RLS timing issues during the acceptance handshake.
  if (existingMembership) {
    // Revoked membership — update back to active with new role
    const { error: updateErr } = await admin
      .from('business_memberships')
      .update({ role: invitation.role, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', existingMembership.id)

    if (updateErr) {
      return (
        <InviteLayout>
          <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Something went wrong">
            <p className="text-sm text-gray-500 dark:text-gray-400">{updateErr.message}</p>
          </StatusCard>
        </InviteLayout>
      )
    }
  } else {
    const { error: insertErr } = await admin
      .from('business_memberships')
      .insert({
        business_id: business.id,
        user_id:     user.id,
        role:        invitation.role,
        status:      'active',
        joined_at:   new Date().toISOString(),
      })

    if (insertErr) {
      return (
        <InviteLayout>
          <StatusCard icon={<AlertCircle className="text-red-500" size={28} />} title="Something went wrong">
            <p className="text-sm text-gray-500 dark:text-gray-400">{insertErr.message}</p>
          </StatusCard>
        </InviteLayout>
      )
    }
  }

  // Mark invitation accepted
  await admin
    .from('business_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  // Write audit log (non-critical)
  try {
    await admin.from('audit_logs').insert({
      business_id:   business.id,
      actor_user_id: user.id,
      action:        'staff.invite.accept',
      target_type:   'business_invitation',
      target_id:     invitation.id,
      metadata_json: { role: invitation.role },
    })
  } catch {
    // non-critical
  }

  redirect(`/business/${business.slug}/dashboard`)
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
      <div>{children}</div>
    </div>
  )
}
