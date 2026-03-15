'use client'

import Link from 'next/link'

type Customer = {
  id: string
  name: string
  totalSpent: number
  visits: number
  lastVisit: string
  avgBasket: number
}

export default function CustomerInsights({ customers }: { customers: Customer[] }) {
  if (customers.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-neutral-500">No customer sales data yet.</p>
  }

  const maxSpent = customers[0].totalSpent

  return (
    <div className="space-y-3">
      {customers.map((c, i) => (
        <Link
          key={c.id}
          href={`/dashboard/customers/${c.id}`}
          className="flex items-center gap-4 p-3 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          {/* Rank */}
          <span className="text-xs text-gray-400 dark:text-neutral-500 w-4 shrink-0">{i + 1}</span>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-gray-600 dark:text-neutral-300">
              {c.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-sm font-semibold tabular-nums ml-2 shrink-0">R{c.totalSpent.toFixed(2)}</p>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-black dark:bg-white"
                style={{ width: `${maxSpent > 0 ? (c.totalSpent / maxSpent) * 100 : 0}%` }}
              />
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-gray-400 dark:text-neutral-500">{c.visits} visit{c.visits !== 1 ? 's' : ''}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500">avg R{c.avgBasket.toFixed(2)}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500">
                last {new Date(c.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
