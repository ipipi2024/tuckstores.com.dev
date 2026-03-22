'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  Home,
  Store,
  ShoppingBag,
  MessageSquare,
  Megaphone,
  Bell,
  User,
  Menu,
  X,
  ChevronLeft,
  PanelLeftOpen,
  Briefcase,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import { useNotifications } from './NotificationProvider'
import { signOut } from '@/app/auth/actions'
import SubmitButton from './ui/SubmitButton'
import HeaderCartIcon from '@/app/app/HeaderCartIcon'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
  badge?: 'orders' | 'messages' | 'notifications'
}

const NAV: NavItem[] = [
  { href: '/app',               label: 'Home',          icon: Home,          exact: true },
  { href: '/businesses',        label: 'Explore',       icon: Store },
  { href: '/app/orders',        label: 'Orders',        icon: ShoppingBag,   badge: 'orders' },
  { href: '/app/messages',      label: 'Messages',      icon: MessageSquare, badge: 'messages' },
  { href: '/app/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/app/notifications', label: 'Notifications', icon: Bell,          badge: 'notifications' },
  { href: '/app/profile',       label: 'Account',       icon: User },
]

const POLL_INTERVAL = 30_000

function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

type Props = {
  userName?: string | null
  ordersBadge?: number
  messagesBadge?: number
}

export default function CustomerNav({ userName, ordersBadge = 0, messagesBadge = 0 }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [counts, setCounts] = useState({ orders: ordersBadge, messages: messagesBadge })

  const { unreadCount: notificationsCount } = useNotifications()

  useEffect(() => {
    setCounts((c) => ({ ...c, orders: ordersBadge, messages: messagesBadge }))
  }, [ordersBadge, messagesBadge])

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed)
    return () => { document.body.classList.remove('sidebar-collapsed') }
  }, [collapsed])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/app/badge-counts')
      if (!res.ok) return
      const { activeOrders, unreadMessages } = await res.json()
      setCounts({ orders: activeOrders ?? 0, messages: unreadMessages ?? 0 })
    } catch {
      // ignore network errors
    }
  }, [])

  useEffect(() => { refresh() }, [pathname, refresh])
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  const badgeCounts: Record<string, number> = {
    orders: counts.orders,
    messages: counts.messages,
    notifications: notificationsCount,
  }

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = isActive(href, pathname, exact)
        const count = badge ? (badgeCounts[badge] ?? 0) : 0
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 rounded-md text-sm transition-colors ${
              mobile ? 'py-3' : 'py-2'
            } ${
              active
                ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white'
            }`}
          >
            <Icon size={mobile ? 18 : 16} strokeWidth={1.75} />
            {label}
            {count > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        )
      })}
    </>
  )

  const Footer = () => (
    <div className="px-4 py-4 border-t dark:border-neutral-800 flex items-center justify-between">
      <ThemeToggle />
      <form action={signOut}>
        <SubmitButton
          pendingText="…"
          className="text-xs text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50"
        >
          Sign out
        </SubmitButton>
      </form>
    </div>
  )

  const SidebarHeader = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`border-b dark:border-neutral-800 ${mobile ? 'px-5 py-4' : 'px-4 py-3'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0 w-7 h-7 rounded bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <User size={14} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="text-sm font-semibold truncate text-gray-900 dark:text-white">
          {userName ?? 'My Account'}
        </span>
      </div>
      <Link
        href="/business/select"
        className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <Briefcase size={10} />
        Business Dashboard
      </Link>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 border-r dark:border-neutral-800 bg-white dark:bg-neutral-950 z-30 transition-all duration-300 w-56 ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 border-b dark:border-neutral-800 h-14">
          <span className="text-base font-bold tracking-tight">TuckStores</span>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <SidebarHeader />

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <NavLinks />
        </nav>

        <Footer />
      </aside>

      {/* ── Desktop re-open button (collapsed state) ── */}
      <button
        onClick={() => setCollapsed(false)}
        aria-label="Expand sidebar"
        className={`hidden lg:flex fixed top-4 left-4 z-40 items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-neutral-900 border dark:border-neutral-700 shadow-sm text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-all duration-300 ${
          collapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PanelLeftOpen size={16} />
      </button>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 flex items-center justify-between px-4 border-b dark:border-neutral-800 bg-white dark:bg-neutral-950 z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-1 -ml-1 text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <Menu size={22} />
        </button>
        <span className="text-sm font-bold tracking-tight absolute left-1/2 -translate-x-1/2 truncate max-w-[180px]">
          TuckStores
        </span>
        <div className="flex items-center gap-1">
          <HeaderCartIcon />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white dark:bg-neutral-950 border-r dark:border-neutral-800 z-50 flex flex-col transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-neutral-800">
          <span className="text-base font-bold tracking-tight">TuckStores</span>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <SidebarHeader mobile />

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <NavLinks mobile />
        </nav>

        <Footer />
      </div>
    </>
  )
}
