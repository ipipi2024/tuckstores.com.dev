'use client'

/**
 * NotificationBell
 *
 * Shows unread notification count from context (updated via Realtime).
 * Navigates to /app/notifications on click.
 *
 * Also renders a push subscription toggle — opt-in only, never prompted
 * automatically. User must explicitly click to enable push notifications.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff } from 'lucide-react'
import { useNotifications } from './NotificationProvider'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export default function NotificationBell({ notificationsPath = '/app/notifications' }: { notificationsPath?: string }) {
  const router = useRouter()
  const { unreadCount } = useNotifications()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Check if push is already subscribed on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setPushEnabled(!!sub)
      })
    })
  }, [])

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })
      setPushEnabled(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  async function disablePush() {
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushEnabled(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu((v) => !v)}
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

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 py-1 text-sm">
          <button
            onClick={() => { setShowMenu(false); router.push(notificationsPath) }}
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-800 dark:text-neutral-100 flex items-center justify-between"
          >
            View all notifications
            {unreadCount > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <div className="border-t border-gray-100 dark:border-neutral-800 my-1" />

          {/* Push opt-in toggle — explicit, never auto-prompted */}
          <button
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={pushLoading}
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 flex items-center gap-2 disabled:opacity-50"
          >
            {pushEnabled ? <BellOff size={14} /> : <Bell size={14} />}
            {pushLoading
              ? 'Updating…'
              : pushEnabled
              ? 'Disable push alerts'
              : 'Enable push alerts'}
          </button>
        </div>
      )}
    </div>
  )
}
