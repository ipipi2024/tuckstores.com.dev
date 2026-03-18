'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, ShoppingBag, MessageSquare, Store, User } from 'lucide-react'

const NAV = [
  { href: '/app',          label: 'Home',     icon: Home,          exact: true,  badge: null },
  { href: '/businesses',   label: 'Stores',   icon: Store,         exact: false, badge: null },
  { href: '/app/messages', label: 'Messages', icon: MessageSquare, exact: false, badge: 'messages' as const },
  { href: '/app/orders',   label: 'Orders',   icon: ShoppingBag,   exact: false, badge: 'orders' as const },
  { href: '/app/profile',  label: 'Profile',  icon: User,          exact: false, badge: null },
]

const POLL_INTERVAL = 30_000 // 30 seconds

export default function AppNav({
  ordersBadge = 0,
  messagesBadge = 0,
}: {
  ordersBadge?: number
  messagesBadge?: number
}) {
  const pathname = usePathname()
  const [counts, setCounts] = useState({ orders: ordersBadge, messages: messagesBadge })

  // Keep counts in sync if server re-renders with fresh values (e.g. after navigation)
  useEffect(() => {
    setCounts({ orders: ordersBadge, messages: messagesBadge })
  }, [ordersBadge, messagesBadge])

  // Poll for fresh badge counts every 30s
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch('/api/app/badge-counts')
        if (!res.ok) return
        const { activeOrders, unreadMessages } = await res.json()
        setCounts({ orders: activeOrders, messages: unreadMessages })
      } catch {
        // ignore network errors
      }
    }

    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 safe-area-bottom">
      <div className="max-w-lg mx-auto flex">
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          const count = badge ? counts[badge] : 0
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
