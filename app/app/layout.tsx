import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import CustomerNav from '@/components/CustomerNav'
import { NotificationProvider } from '@/components/NotificationProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const admin = createAdminClient()

  const [{ data: unseenOrders }, convResult, { count: unreadNotifications }, { data: profile }] = await Promise.all([
    admin.rpc('count_customer_unseen_orders', { p_user_id: user.id }),
    admin
      .from('conversations')
      .select('updated_at, customer_last_read_at')
      .eq('customer_user_id', user.id)
      .limit(100),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
    admin
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const unreadMessages = (convResult.data ?? []).filter(
    (c) => !c.customer_last_read_at || new Date(c.updated_at) > new Date(c.customer_last_read_at)
  ).length

  return (
    <NotificationProvider userId={user.id} initialUnreadCount={unreadNotifications ?? 0}>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
        <CustomerNav
          userName={profile?.full_name ?? null}
          ordersBadge={unseenOrders ?? 0}
          messagesBadge={unreadMessages}
        />
        <main className="lg:pl-56 pt-14 lg:pt-0 transition-all duration-300">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </NotificationProvider>
  )
}
