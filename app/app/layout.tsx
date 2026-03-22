import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import AppNav from './AppNav'
import HeaderCartIcon from './HeaderCartIcon'
import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { NotificationProvider } from '@/components/NotificationProvider'
import NotificationBell from '@/components/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const admin = createAdminClient()

  const [{ count: activeOrders }, convResult, { count: unreadNotifications }] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_user_id', user.id)
      .in('status', ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery']),
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
  ])

  const unreadMessages = (convResult.data ?? []).filter(
    (c) => !c.customer_last_read_at || new Date(c.updated_at) > new Date(c.customer_last_read_at)
  ).length

  return (
    <NotificationProvider userId={user.id} initialUnreadCount={unreadNotifications ?? 0}>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 pb-20">
        <header className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 h-12 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            TuckStores
          </span>
          <div className="flex items-center gap-2">
            <HeaderCartIcon />
            <NotificationBell />
            <Link
              href="/business/select"
              className="p-1.5 text-gray-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Business Dashboard"
            >
              <Briefcase size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-5">
          {children}
        </main>
        <AppNav ordersBadge={activeOrders ?? 0} messagesBadge={unreadMessages} />
      </div>
    </NotificationProvider>
  )
}
