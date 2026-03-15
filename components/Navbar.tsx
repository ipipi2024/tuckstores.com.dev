'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  PackagePlus,
  Boxes,
  Tag,
  Users,
  Truck,
  BarChart2,
  Menu,
  X,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { signOut } from '@/app/auth/actions'

const nav = [
  { href: '/dashboard',            label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: '/dashboard/pos',        label: 'POS',        icon: ShoppingCart },
  { href: '/dashboard/analytics',  label: 'Analytics',  icon: BarChart2 },
  { href: '/dashboard/sales',      label: 'Sales',      icon: TrendingUp },
  { href: '/dashboard/purchases',  label: 'Purchases',  icon: PackagePlus },
  { href: '/dashboard/inventory',  label: 'Inventory',  icon: Boxes },
  { href: '/dashboard/products',   label: 'Products',   icon: Tag },
  { href: '/dashboard/customers',  label: 'Customers',  icon: Users },
  { href: '/dashboard/suppliers',  label: 'Suppliers',  icon: Truck },
]

function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

export default function Navbar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 border-r dark:border-neutral-800 bg-white dark:bg-neutral-950 z-30">
        <div className="px-5 py-5 border-b dark:border-neutral-800">
          <span className="text-base font-bold tracking-tight">TuckStores</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, pathname, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                    : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white'
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t dark:border-neutral-800 flex items-center justify-between">
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-xs text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 flex items-center justify-between px-4 border-b dark:border-neutral-800 bg-white dark:bg-neutral-950 z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-1 -ml-1 text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <Menu size={22} />
        </button>
        <span className="text-base font-bold tracking-tight absolute left-1/2 -translate-x-1/2">TuckStores</span>
        <ThemeToggle />
      </header>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile slide-in drawer ── */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white dark:bg-neutral-950 border-r dark:border-neutral-800 z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Drawer header */}
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

        {/* Drawer links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, pathname, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                    : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Drawer footer */}
        <div className="px-4 py-4 border-t dark:border-neutral-800 flex items-center justify-between">
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-xs text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
