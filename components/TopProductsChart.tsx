'use client'

import { useState } from 'react'

type Product = { name: string; revenue: number; quantity: number }
type SortBy = 'revenue' | 'quantity'

export default function TopProductsChart({ products, currencyCode }: { products: Product[]; currencyCode: string }) {
  const [sortBy, setSortBy] = useState<SortBy>('revenue')
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 }).format(n)

  const sorted = [...products].sort((a, b) => b[sortBy] - a[sortBy])
  const max = sorted[0]?.[sortBy] ?? 1

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 w-fit">
        {(['revenue', 'quantity'] as SortBy[]).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              sortBy === s
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            By {s}
          </button>
        ))}
      </div>

      {/* Bars */}
      <div className="space-y-3">
        {sorted.map((p, i) => {
          const pct = max > 0 ? (p[sortBy] / max) * 100 : 0
          const value = sortBy === 'revenue' ? fmt(p.revenue) : `${p.quantity} units`
          return (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 dark:text-neutral-500 w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-sm font-semibold tabular-nums ml-3 shrink-0">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-black dark:bg-white transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
