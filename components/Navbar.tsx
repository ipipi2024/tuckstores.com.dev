'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

// bottom tabs (mobile) — most-used 5
const bottomTabs = nav.filter((n) =>
  ['/dashboard', '/dashboard/pos', '/dashboard/sales', '/dashboard/inventory', '/dashboard/analytics'].includes(n.href)
)

function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

export default function Navbar() {
  const pathname = usePathname()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 border-r dark:border-neutral-800 bg-white dark:bg-neutral-950 z-30">
        {/* Brand */}
        <div className="px-5 py-5 border-b dark:border-neutral-800">
          <span className="text-base font-bold tracking-tight">TuckStores</span>
        </div>

        {/* Links */}
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

        {/* Footer */}
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
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 flex items-center justify-between px-4 border-b dark:border-neutral-800 bg-white dark:bg-neutral-950 z-30">
        <span className="text-base font-bold tracking-tight">TuckStores</span>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-xs text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 flex items-center justify-around border-t dark:border-neutral-800 bg-white dark:bg-neutral-950 z-30">
        {bottomTabs.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, pathname, exact)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                active
                  ? 'text-black dark:text-white font-medium'
                  : 'text-gray-400 dark:text-neutral-500'
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
