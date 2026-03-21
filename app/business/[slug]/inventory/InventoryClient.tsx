'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Package, CheckCircle2, AlertTriangle, XCircle, SlidersHorizontal } from 'lucide-react'

export type StockEntry = {
  product_id: string
  name: string
  sku: string | null
  category: string | null
  stock_quantity: number
  base_unit: string
}

type Props = {
  entries: StockEntry[]
  slug: string
  canAdjust: boolean
}

type SortKey = 'stock_asc' | 'stock_desc' | 'name_asc' | 'name_desc'
type StatusFilter = 'all' | 'in_stock' | 'low' | 'out'

function fmtStock(qty: number, baseUnit: string): string {
  if (baseUnit === 'unit') return String(Math.round(qty))
  return `${Number(qty).toFixed(3)} ${baseUnit}`
}

function StatusBadge({ qty }: { qty: number }) {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
        <XCircle size={10} />
        Out of stock
      </span>
    )
  }
  if (qty <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle size={10} />
        Low stock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
      <CheckCircle2 size={10} />
      In stock
    </span>
  )
}

export default function InventoryClient({ entries, slug, canAdjust }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('stock_asc')

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const e of entries) {
      if (e.category) cats.add(e.category)
    }
    return Array.from(cats).sort()
  }, [entries])

  const filtered = useMemo(() => {
    let result = entries

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || (e.sku?.toLowerCase().includes(q) ?? false)
      )
    }

    if (statusFilter === 'out') result = result.filter((e) => e.stock_quantity <= 0)
    else if (statusFilter === 'low') result = result.filter((e) => e.stock_quantity > 0 && e.stock_quantity <= 5)
    else if (statusFilter === 'in_stock') result = result.filter((e) => e.stock_quantity > 5)

    if (categoryFilter !== 'all') {
      result = result.filter((e) => e.category === categoryFilter)
    }

    return [...result].sort((a, b) => {
      if (sort === 'stock_asc') return a.stock_quantity - b.stock_quantity
      if (sort === 'stock_desc') return b.stock_quantity - a.stock_quantity
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      return 0
    })
  }, [entries, search, statusFilter, categoryFilter, sort])

  // Empty state — no products at all
  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Package size={22} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No inventory data yet</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
          Add stock by recording a purchase or by manually adjusting inventory.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={`/business/${slug}/purchases/new`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Record a purchase
          </Link>
          {canAdjust && (
            <Link
              href={`/business/${slug}/inventory/adjust`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Adjust inventory
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="stock_asc">Lowest stock</option>
          <option value="stock_desc">Highest stock</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>

        <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto whitespace-nowrap">
          {filtered.length === entries.length
            ? `${entries.length} product${entries.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${entries.length}`}
        </span>
      </div>

      {/* No-results state */}
      {filtered.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No products match your filters.</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all') }}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden sm:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left bg-gray-50/60 dark:bg-neutral-800/40">
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Product</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500 hidden md:table-cell">Category</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Status</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500 text-right">Stock</th>
                  {canAdjust && <th className="px-4 py-2.5 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                {filtered.map((entry) => (
                  <tr
                    key={entry.product_id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">{entry.name}</span>
                      {entry.sku && (
                        <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500 font-normal">
                          #{entry.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {entry.category ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge qty={entry.stock_quantity} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`text-base font-semibold ${
                        entry.stock_quantity <= 0
                          ? 'text-red-600 dark:text-red-400'
                          : entry.stock_quantity <= 5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-800 dark:text-gray-100'
                      }`}>
                        {fmtStock(entry.stock_quantity, entry.base_unit)}
                      </span>
                    </td>
                    {canAdjust && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/inventory/adjust?product=${entry.product_id}`}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Adjust
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile card list */}
      {filtered.length > 0 && (
        <div className="sm:hidden space-y-2">
          {filtered.map((entry) => (
            <div
              key={entry.product_id}
              className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-gray-900 dark:text-white leading-snug truncate">
                    {entry.name}
                  </p>
                  {(entry.sku || entry.category) && (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {[entry.sku ? `#${entry.sku}` : null, entry.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <StatusBadge qty={entry.stock_quantity} />
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-0.5">Stock</p>
                  <span className={`text-xl font-bold tabular-nums leading-none ${
                    entry.stock_quantity <= 0
                      ? 'text-red-600 dark:text-red-400'
                      : entry.stock_quantity <= 5
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-800 dark:text-gray-100'
                  }`}>
                    {fmtStock(entry.stock_quantity, entry.base_unit)}
                  </span>
                </div>
                {canAdjust && (
                  <Link
                    href={`/business/${slug}/inventory/adjust?product=${entry.product_id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <SlidersHorizontal size={11} />
                    Adjust
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
