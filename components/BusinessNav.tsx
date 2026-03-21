'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  BarChart2,
  TrendingUp,
  PackagePlus,
  Boxes,
  Tag,
  Truck,
  Users,
  Contact,
  MessageSquare,
  Megaphone,
  Bell,
  Settings2,
  CreditCard,
  Menu,
  X,
  ChevronLeft,
  PanelLeftOpen,
  Store,
  ArrowLeftRight,
  UserCircle,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import { useNotifications } from './NotificationProvider'
import { signOut } from '@/app/auth/actions'
import { isAtLeastRole } from '@/lib/auth/permissions'
import SubmitButton from './ui/SubmitButton'
import type { MembershipRole } from '@/lib/auth/permissions'

type NavItem = {
  label: string
  path: string
  icon: React.ElementType
  exact?: boolean
  minRole: MembershipRole
  badge?: 'messages' | 'notifications'
}

const ALL_NAV: NavItem[] = [
  { label: 'Dashboard',  path: '/dashboard',  icon: LayoutDashboard, exact: true, minRole: 'staff' },
  { label: 'POS',        path: '/pos',         icon: ShoppingCart,               minRole: 'cashier' },
  { label: 'Orders',     path: '/orders',      icon: ShoppingBag,                minRole: 'cashier' },
  { label: 'Analytics',  path: '/analytics',   icon: BarChart2,                  minRole: 'manager' },
  { label: 'Sales',      path: '/sales',       icon: TrendingUp,                 minRole: 'cashier' },
  { label: 'Customers',  path: '/customers',   icon: Contact,                    minRole: 'cashier' },
  { label: 'Purchases',  path: '/purchases',   icon: PackagePlus,                minRole: 'inventory_clerk' },
  { label: 'Inventory',  path: '/inventory',   icon: Boxes,                      minRole: 'staff' },
  { label: 'Products',   path: '/products',    icon: Tag,                        minRole: 'staff' },
  { label: 'Suppliers',  path: '/suppliers',   icon: Truck,                      minRole: 'inventory_clerk' },
  { label: 'Messages',       path: '/messages',       icon: MessageSquare, minRole: 'staff',   badge: 'messages' as const },
  { label: 'Announcements', path: '/announcements', icon: Megaphone,     minRole: 'manager' },
  { label: 'Notifications', path: '/notifications', icon: Bell,          minRole: 'staff',   badge: 'notifications' as const },
  { label: 'Staff',         path: '/staff',         icon: Users,         minRole: 'admin' },
  { label: 'Settings',   path: '/settings',    icon: Settings2,                  minRole: 'admin' },
  { label: 'Billing',    path: '/billing',     icon: CreditCard,                 minRole: 'owner' },
]

function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

type Props = {
  slug: string
  businessName: string
  role: MembershipRole
  messagesBadge?: number
}

export default function BusinessNav({ slug, businessName, role, messagesBadge = 0 }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const base = `/business/${slug}`
  const navItems = ALL_NAV.filter((item) => isAtLeastRole(role, item.minRole))

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed)
    return () => { document.body.classList.remove('sidebar-collapsed') }
  }, [collapsed])

  const { unreadCount: notificationsCount } = useNotifications()
  const badgeCounts: Record<string, number> = { messages: messagesBadge, notifications: notificationsCount }

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map(({ path, label, icon: Icon, exact, badge }) => {
        const href = `${base}${path}`
        const active = isActive(href, pathname, exact)
        const count = badge ? (badgeCounts[badge] ?? 0) : 0
        return (
          <Link
            key={path}
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
        <SubmitButton pendingText="…" className="text-xs text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50">
          Sign out
        </SubmitButton>
      </form>
    </div>
  )

  const BusinessHeader = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`border-b dark:border-neutral-800 ${mobile ? 'px-5 py-4' : 'px-4 py-3'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0 w-7 h-7 rounded bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <Store size={14} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="text-sm font-semibold truncate text-gray-900 dark:text-white">
          {businessName}
        </span>
      </div>
      <Link
        href="/business/select"
        className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <ArrowLeftRight size={10} />
        Switch business
      </Link>
      <Link
        href="/app"
        className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <UserCircle size={10} />
        Customer view
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

        <BusinessHeader />

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
          {businessName}
        </span>
        <div className="flex items-center gap-1">
          <NotificationBell notificationsPath={`/business/${slug}/notifications`} />
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

        <BusinessHeader mobile />

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <NavLinks mobile />
        </nav>

        <Footer />
      </div>
    </>
  )
}
