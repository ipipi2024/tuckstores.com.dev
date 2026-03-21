'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, ShoppingCart, Building2 } from 'lucide-react'

export type PurchaseEntry = {
  id: string
  purchase_date: string | null
  supplier_name: string | null
  total_amount: number | null
  status: string
  currency: string
}

type Props = {
  purchases: PurchaseEntry[]
  slug: string
  canCreate: boolean
}

type StatusFilter = 'all' | 'received' | 'ordered' | 'draft'
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  ordered:  'Ordered',
  draft:    'Draft',
}

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ordered:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  draft:    'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
}

function fmt(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function PurchasesClient({ purchases, slug, canCreate }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const filtered = useMemo(() => {
    let result = purchases

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) =>
        (p.supplier_name?.toLowerCase().includes(q) ?? false)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    return [...result].sort((a, b) => {
      if (sort === 'newest') {
        return new Date(b.purchase_date ?? '').getTime() - new Date(a.purchase_date ?? '').getTime()
      }
      if (sort === 'oldest') {
        return new Date(a.purchase_date ?? '').getTime() - new Date(b.purchase_date ?? '').getTime()
      }
      if (sort === 'amount_desc') return (b.total_amount ?? 0) - (a.total_amount ?? 0)
      if (sort === 'amount_asc') return (a.total_amount ?? 0) - (b.total_amount ?? 0)
      return 0
    })
  }, [purchases, search, statusFilter, sort])

  // True empty
  if (purchases.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <ShoppingCart size={22} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No purchases yet</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
          Record stock purchases from suppliers to keep your inventory up to date.
        </p>
        {canCreate && (
          <Link
            href={`/business/${slug}/purchases/new`}
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Record first purchase
          </Link>
        )}
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
            placeholder="Search by supplier…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          <option value="received">Received</option>
          <option value="ordered">Ordered</option>
          <option value="draft">Draft</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount_desc">Amount: high to low</option>
          <option value="amount_asc">Amount: low to high</option>
        </select>

        <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto whitespace-nowrap">
          {filtered.length === purchases.length
            ? `${purchases.length} record${purchases.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${purchases.length}`}
        </span>
      </div>

      {/* No-results state */}
      {filtered.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No purchases match your filters.</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all') }}
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
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Date</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Supplier</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500 text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Status</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors group"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {fmtDate(p.purchase_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {p.supplier_name ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-gray-300 dark:text-neutral-600 flex-shrink-0" />
                          {p.supplier_name}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmt(p.total_amount, p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/business/${slug}/purchases/${p.id}`}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View
                      </Link>
                    </td>
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
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/business/${slug}/purchases/${p.id}`}
              className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {fmtDate(p.purchase_date)}
                </p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
                  {p.supplier_name ?? 'No supplier'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                  {fmt(p.total_amount, p.currency)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
              <ChevronRight size={14} className="text-gray-300 dark:text-neutral-600 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
