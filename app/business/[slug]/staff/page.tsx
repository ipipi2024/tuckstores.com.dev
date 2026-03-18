import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform, ROLE_LEVEL, type MembershipRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, UserPlus, Mail, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import MemberActions from './MemberActions'
import InvitationActions from './InvitationActions'
import CopyButton from './CopyButton'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; invited?: string }>
}

const ROLE_LABELS: Record<string, string> = {
  owner:           'Owner',
  admin:           'Admin',
  manager:         'Manager',
  cashier:         'Cashier',
  inventory_clerk: 'Inventory Clerk',
  staff:           'Staff',
}

const ROLE_COLORS: Record<string, string> = {
  owner:           'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin:           'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  manager:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cashier:         'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  inventory_clerk: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  staff:           'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'text-green-600 dark:text-green-400',
  suspended: 'text-red-500 dark:text-red-400',
  invited:   'text-blue-500 dark:text-blue-400',
  revoked:   'text-gray-400 dark:text-neutral-500',
}

export default async function StaffPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error, invited } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_staff')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const canManage = canPerform(ctx.membership.role, 'manage_staff')
  const supabase = await createClient()

  // Get current user ID for self-identification
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from('business_memberships')
      .select('id, role, status, joined_at, user_id, users ( id, full_name, email )')
      .eq('business_id', ctx.business.id)
      .in('status', ['active', 'suspended'])
      .order('created_at', { ascending: true }),

    canManage
      ? supabase
          .from('business_invitations')
          .select('id, email, role, status, expires_at, created_at')
          .eq('business_id', ctx.business.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // Count active owners for last-owner protection
  const activeOwnerCount = (members ?? []).filter(
    (m) => m.role === 'owner' && m.status === 'active'
  ).length

  // Build the list of roles that the current actor can assign
  const ALL_ROLES: Array<{ value: MembershipRole; label: string }> = [
    { value: 'owner',           label: 'Owner' },
    { value: 'admin',           label: 'Admin' },
    { value: 'manager',         label: 'Manager' },
    { value: 'cashier',         label: 'Cashier' },
    { value: 'inventory_clerk', label: 'Inventory Clerk' },
    { value: 'staff',           label: 'Staff' },
  ]
  const assignableRoles = ALL_ROLES.filter(
    (r) => ctx.membership.role === 'owner' || ROLE_LEVEL[r.value] < ROLE_LEVEL[ctx.membership.role]
  )

  // Build invite link from token
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const inviteLink = invited ? `${baseUrl}/invite/${invited}` : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} />
            Staff
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <Link
            href={`/business/${slug}/staff/invite`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus size={15} />
            Invite
          </Link>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Invitation link success banner */}
      {inviteLink && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
            <CheckCircle2 size={15} className="flex-shrink-0" />
            Invitation created. Share this link with the invitee:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-neutral-900 border border-green-200 dark:border-green-800 rounded px-3 py-1.5 text-gray-700 dark:text-gray-300 break-all">
              {inviteLink}
            </code>
            <CopyButton text={inviteLink} />
          </div>
          <p className="text-xs text-green-600 dark:text-green-500">Expires in 7 days. Valid for one use.</p>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!members || members.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400 dark:text-neutral-500">
            No members found.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
            {members.map((m) => {
              const user = Array.isArray(m.users) ? m.users[0] : m.users
              const name = user?.full_name || user?.email || 'Unknown'
              const email = user?.email
              const isSelf = user?.id === currentUser?.id
              const isProtectedOwner =
                m.role === 'owner' && m.status === 'active' && activeOwnerCount <= 1

              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-4">
                  {/* Avatar */}
                  <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-neutral-300">
                    {name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-gray-400 dark:text-neutral-500 font-normal">(you)</span>
                      )}
                    </p>
                    {email && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{email}</p>
                    )}
                  </div>

                  {/* Role badge (read-only display) */}
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline-block ${ROLE_COLORS[m.role] ?? ROLE_COLORS.staff}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>

                  {/* Status */}
                  {m.status === 'suspended' && (
                    <span className={`shrink-0 text-xs font-medium ${STATUS_COLORS.suspended}`}>
                      Suspended
                    </span>
                  )}

                  {/* Controls */}
                  {canManage && (
                    <MemberActions
                      slug={slug}
                      membershipId={m.id}
                      currentRole={m.role as MembershipRole}
                      currentStatus={m.status}
                      isSelf={isSelf}
                      isProtectedOwner={isProtectedOwner}
                      assignableRoles={assignableRoles}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      {canManage && invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            Pending invitations
          </h2>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
              {invitations.map((inv) => {
                const isExpired = new Date(inv.expires_at) < new Date()
                return (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Mail size={14} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{inv.email}</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500">
                        {ROLE_LABELS[inv.role] ?? inv.role}
                        {isExpired && <span className="text-red-400 dark:text-red-500 ml-2">· Expired</span>}
                        {!isExpired && (
                          <span className="ml-2">
                            · expires {new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </p>
                    </div>
                    {!isExpired && (
                      <InvitationActions slug={slug} invitationId={inv.id} />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
