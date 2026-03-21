'use client'

/**
 * NotificationBell
 *
 * Shows the unread notification count and navigates to the notifications page
 * on click. Behaves like a standard nav link — no dropdown, no popup.
 *
 * TODO: The push notification opt-in/opt-out toggle was removed from here
 * along with the dropdown. Move it to the notifications page when ready.
 */

import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useNotifications } from './NotificationProvider'

export default function NotificationBell({ notificationsPath = '/app/notifications' }: { notificationsPath?: string }) {
  const router = useRouter()
  const { unreadCount } = useNotifications()

  return (
    <button
      onClick={() => router.push(notificationsPath)}
      aria-label="Notifications"
      className="relative p-1.5 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      <Bell size={18} strokeWidth={1.75} />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
