import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { grantCredit } from './actions'

type UserRow = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  subscriptions: { expires_at: string }[] | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id, email, full_name, created_at, subscriptions(expires_at)')
    .order('created_at', { ascending: false })

  const now = new Date()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin — Subscriptions</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Grant +30 days to any user after they pay.
          </p>
        </div>

        <div className="space-y-2">
          {(users as UserRow[] | null)?.map(u => {
            const sub = u.subscriptions?.[0]
            const isActive = sub && new Date(sub.expires_at) > now
            const daysLeft = sub
              ? Math.ceil((new Date(sub.expires_at).getTime() - now.getTime()) / 86400000)
              : null

            return (
              <div
                key={u.id}
                className="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {u.email ?? '—'}
                  </p>
                  {u.full_name && (
                    <p className="text-xs text-gray-400 dark:text-neutral-500">{u.full_name}</p>
                  )}
                  <p className="text-xs mt-1">
                    {isActive ? (
                      <span className="text-green-600 dark:text-green-400">
                        Active · {daysLeft! > 0 ? `${daysLeft}d left` : 'expires today'} (
                        {new Date(sub!.expires_at).toLocaleDateString()})
                      </span>
                    ) : sub ? (
                      <span className="text-red-500">
                        Expired {new Date(sub.expires_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-neutral-500">No subscription</span>
                    )}
                  </p>
                </div>

                <form action={grantCredit}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <button
                    type="submit"
                    className="text-xs bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-md hover:opacity-75 transition-opacity whitespace-nowrap"
                  >
                    +30 days
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
