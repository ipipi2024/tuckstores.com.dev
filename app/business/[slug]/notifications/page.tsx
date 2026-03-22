import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import MarkAllReadButton from './MarkAllReadButton'
import NotificationList from '@/app/app/notifications/NotificationList'

type Props = { params: Promise<{ slug: string }> }

export default async function BusinessNotificationsPage({ params }: Props) {
  const { slug } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  const PAGE_SIZE = 30

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  const allNotifications = notifications ?? []
  const hasMore = allNotifications.length === PAGE_SIZE
  const unreadCount = allNotifications.filter((n) => !n.read_at).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={18} />
            Notifications
          </h2>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>

        {unreadCount > 0 && <MarkAllReadButton slug={slug} />}
      </div>

      {allNotifications.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-12 text-center">
          <Bell size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-400 dark:text-neutral-500">No notifications yet</p>
        </div>
      ) : (
        <NotificationList notifications={allNotifications} initialHasMore={hasMore} isCustomer={false} />
      )}
    </div>
  )
}
