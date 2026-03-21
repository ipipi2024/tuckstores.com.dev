'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Home, ShoppingBag, ShoppingCart, Store, User } from 'lucide-react'
import { useNotifications } from '@/components/NotificationProvider'
import { getCart, getItemCount } from '@/lib/cart/store'

const NAV = [
  { href: '/app',         label: 'Home',    icon: Home,         exact: true,  badge: null },
  { href: '/businesses',  label: 'Explore', icon: Store,        exact: false, badge: null },
  { href: '/app/cart',    label: 'Cart',    icon: ShoppingCart, exact: false, badge: 'cart' as const },
  { href: '/app/orders',  label: 'Orders',  icon: ShoppingBag,  exact: false, badge: 'orders' as const },
  { href: '/app/profile', label: 'Account', icon: User,         exact: false, badge: null },
]

const POLL_INTERVAL = 30_000 // 30 seconds

export default function AppNav({
  ordersBadge = 0,
}: {
  ordersBadge?: number
}) {
  const pathname = usePathname()
  // notifications count kept for potential future use but not shown in nav
  const { unreadCount: _notificationsCount } = useNotifications()
  const [counts, setCounts] = useState({ orders: ordersBadge, cart: 0 })

  // Sync server-rendered orders badge on navigation
  useEffect(() => {
    setCounts((c) => ({ ...c, orders: ordersBadge }))
  }, [ordersBadge])

  // Sync cart count from localStorage
  useEffect(() => {
    function syncCart() {
      setCounts((c) => ({ ...c, cart: getItemCount(getCart()) }))
    }
    syncCart()
    window.addEventListener('cart-updated', syncCart)
    return () => window.removeEventListener('cart-updated', syncCart)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/app/badge-counts')
      if (!res.ok) return
      const { activeOrders } = await res.json()
      setCounts((c) => ({ ...c, orders: activeOrders }))
    } catch {
      // ignore network errors
    }
  }, [])

  // Refresh badge counts on navigation
  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

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
