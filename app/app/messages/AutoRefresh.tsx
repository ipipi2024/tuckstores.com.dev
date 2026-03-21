'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Silently polls router.refresh() every `intervalMs` ms while the page is visible.
 * Stops when the tab is hidden; resumes when it becomes visible again.
 * Renders nothing — drop this anywhere in a server component tree.
 *
 * Default interval is 15 s. 5 s was too aggressive for a polling-based approach;
 * migrate to Supabase Realtime subscriptions if lower latency is needed.
 */
export default function AutoRefresh({ intervalMs = 15000, refreshOnMount = false }: { intervalMs?: number; refreshOnMount?: boolean }) {
  const router = useRouter()

  // Refresh immediately on mount so the layout re-fetches server data (e.g. unread counts).
  useEffect(() => {
    if (refreshOnMount) router.refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function start() {
      if (interval != null) return
      interval = setInterval(() => router.refresh(), intervalMs)
    }

    function stop() {
      if (interval != null) { clearInterval(interval); interval = null }
    }

    const onVisibility = () =>
      document.visibilityState === 'visible' ? start() : stop()

    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [router, intervalMs])

  return null
}
