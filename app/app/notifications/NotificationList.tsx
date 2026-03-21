'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/components/NotificationProvider'
import { markNotificationRead, fetchOlderNotifications } from './actions'
import { ShoppingBag, Bell } from 'lucide-react'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string>
  read_at: string | null
  created_at: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  order_placed:         ShoppingBag,
  order_status_changed: ShoppingBag,
}

function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)  return `${diffHrs}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function NotificationList({
  notifications,
  initialHasMore = false,
}: {
  notifications: NotificationRow[]
  initialHasMore?: boolean
}) {
  const router = useRouter()
  const { setUnreadCount } = useNotifications()
  const [extras, setExtras] = useState<NotificationRow[]>([])
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)

  const all = [...notifications, ...extras]

  async function handleClick(n: NotificationRow) {
    if (!n.read_at) {
      // Server action returns authoritative unread count after the update
      const newCount = await markNotificationRead(n.id)
      setUnreadCount(newCount)
    }
    const url = n.data?.url
    if (url) router.push(url)
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    const { notifications: next, hasMore: more } = await fetchOlderNotifications(all.length)
    setExtras((prev) => [...prev, ...(next as NotificationRow[])])
    setHasMore(more)
    setLoadingMore(false)
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
      {all.map((n) => {
        const Icon = TYPE_ICON[n.type] ?? Bell
        const isUnread = !n.read_at
        return (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors ${
              isUnread ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
            }`}
          >
            <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
              isUnread
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500'
            }`}>
              <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-neutral-300'}`}>
                {n.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                {n.body}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-xs text-gray-400 dark:text-neutral-500 whitespace-nowrap">
                {fmtTime(n.created_at)}
              </span>
              {isUnread && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
          </button>
        )
      })}

      {hasMore && (
        <div className="px-4 py-3 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
