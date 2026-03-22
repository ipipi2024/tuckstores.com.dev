'use client'

/**
 * NotificationProvider — wraps the app (or a layout section) with a shared
 * notification context. Uses Supabase Realtime to update the unread count and
 * latest notification in local state — no router.refresh() required for the bell.
 *
 * Place this at layout level, passing userId and the server-fetched initial
 * unread count as props so the first render is instant.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationSeen } from '@/app/app/notifications/actions'

export type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string>
  read_at: string | null
  created_at: string
}

type NotificationContextValue = {
  unreadCount: number
  latestNotification: NotificationRow | null
  isCustomer: boolean
  /** Set the count to an authoritative value returned by a server action. */
  setUnreadCount: (n: number) => void
  resetUnread: () => void
  clearLatest: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  latestNotification: null,
  isCustomer: false,
  setUnreadCount: () => {},
  resetUnread: () => {},
  clearLatest: () => {},
})

export function NotificationProvider({
  children,
  userId,
  initialUnreadCount,
  isCustomer,
}: {
  children: ReactNode
  userId: string
  initialUnreadCount: number
  isCustomer: boolean
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [latestNotification, setLatestNotification] = useState<NotificationRow | null>(null)

  // Sync with server-rendered initialUnreadCount when the layout re-renders
  // on navigation. This prevents stale counts from persisting across routes.
  // Safe because Realtime only fires INSERT events (counts up), so a server
  // re-render after navigation already reflects the correct authoritative count.
  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const resetUnread = useCallback(() => setUnreadCount(0), [])
  const clearLatest = useCallback(() => setLatestNotification(null), [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setUnreadCount((c) => c + 1)
          setLatestNotification(payload.new as NotificationRow)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <NotificationContext.Provider
      value={{ unreadCount, latestNotification, isCustomer, setUnreadCount, resetUnread, clearLatest }}
    >
      {children}
      <NotificationToast />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}

// ── In-app toast ──────────────────────────────────────────────────────────────

/**
 * Renders a small fixed toast whenever a new realtime notification arrives.
 * - Auto-dismisses after 4.5 s
 * - Tracks shown IDs so it never replays the same notification
 * - Clicking the toast navigates to notification.data.url
 * Rendered inside NotificationProvider so it works in both /app and /business layouts.
 */
function NotificationToast() {
  const { latestNotification, isCustomer, setUnreadCount, clearLatest } = useContext(NotificationContext)
  const router = useRouter()
  const shownId = useRef<string | null>(null)
  const [current, setCurrent] = useState<NotificationRow | null>(null)

  useEffect(() => {
    if (!latestNotification) return
    if (latestNotification.id === shownId.current) return

    shownId.current = latestNotification.id
    setCurrent(latestNotification)

    const timer = setTimeout(() => {
      setCurrent(null)
      clearLatest()
    }, 4500)
    return () => clearTimeout(timer)
  }, [latestNotification, clearLatest])

  if (!current) return null

  function dismiss() {
    setCurrent(null)
    clearLatest()
  }

  async function handleClick() {
    const url = current?.data?.url
    const notif = current
    // Dismiss immediately for instant visual feedback, then await the write
    // before navigating. Awaiting prevents the route-change layout re-render
    // from racing ahead and re-syncing a stale initialUnreadCount over the
    // correct decrement that markNotificationSeen would return.
    dismiss()
    if (notif) {
      try {
        const newCount = await markNotificationSeen(notif.id, isCustomer)
        setUnreadCount(newCount)
      } catch (err) {
        // Write failed — badge will self-correct on the next layout render
        // since initialUnreadCount re-fetches from the server on route change.
        console.error('[NotificationToast] markNotificationSeen failed:', err)
      }
    }
    if (url) router.push(url)
  }

  return (
    <div
      role="alert"
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 w-72 sm:w-80 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg p-3.5 flex items-start gap-3 cursor-pointer select-none"
    >
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
        <Bell size={13} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {current.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">
          {current.body}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss() }}
        aria-label="Dismiss notification"
        className="shrink-0 text-gray-300 dark:text-neutral-600 hover:text-gray-500 dark:hover:text-neutral-400 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
