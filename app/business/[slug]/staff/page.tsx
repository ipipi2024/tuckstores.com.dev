import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserPlus } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

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

export default async function StaffPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_staff')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const { data: members } = await supabase
    .from('business_memberships')
    .select(`
      id,
      role,
      status,
      joined_at,
      users ( id, full_name, email, avatar_url )
    `)
    .eq('business_id', ctx.business.id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} />
            Staff
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {members?.length ?? 0} member{members?.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canPerform(ctx.membership.role, 'manage_staff') && (
          <button
            disabled
            title="Invitations coming soon"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            <UserPlus size={15} />
            Invite
          </button>
        )}
      </div>

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
              const isYou = user?.id === undefined ? false : false // server can't know current uid here easily
              return (
                <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-neutral-300">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {name}
                    </p>
                    {email && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">
                        {email}
                      </p>
                    )}
                  </div>
                  {/* Role badge */}
                  <span
                    className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      ROLE_COLORS[m.role] ?? ROLE_COLORS.staff
                    }`}
                  >
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
