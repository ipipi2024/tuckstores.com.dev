'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, MessageSquare, Megaphone, Store, User } from 'lucide-react'

const NAV = [
  { href: '/app',               label: 'Home',     icon: Home,          exact: true },
  { href: '/businesses',        label: 'Stores',   icon: Store,         exact: false },
  { href: '/app/messages',      label: 'Messages', icon: MessageSquare, exact: false },
  { href: '/app/receipts',      label: 'Receipts', icon: Receipt,       exact: false },
  { href: '/app/profile',       label: 'Profile',  icon: User,          exact: false },
]

export default function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 safe-area-bottom">
      <div className="max-w-lg mx-auto flex">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
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
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
