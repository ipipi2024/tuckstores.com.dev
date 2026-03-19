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
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

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
  /** Set the count to an authoritative value returned by a server action. */
  setUnreadCount: (n: number) => void
  resetUnread: () => void
  clearLatest: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  latestNotification: null,
  setUnreadCount: () => {},
  resetUnread: () => {},
  clearLatest: () => {},
})

export function NotificationProvider({
  children,
  userId,
  initialUnreadCount,
}: {
  children: ReactNode
  userId: string
  initialUnreadCount: number
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
      value={{ unreadCount, latestNotification, setUnreadCount, resetUnread, clearLatest }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
