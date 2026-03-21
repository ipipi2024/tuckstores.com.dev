'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, ShoppingBag, Truck, Package } from 'lucide-react'

export type OrderEntry = {
  id: string
  order_number: string
  placed_at: string
  status: string
  fulfillment_method: string
  total_amount: number
  customerLabel: string
  currency: string
}

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending',
  accepted:         'Accepted',
  rejected:         'Rejected',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'Out for delivery',
  completed:        'Completed',
  cancelled:        'Cancelled',
}

const STATUS_STYLE: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  accepted:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  rejected:         'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  preparing:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ready:            'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  out_for_delivery: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  completed:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:        'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
}

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'])

type FulfillmentFilter = 'all' | 'pickup' | 'delivery'
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'

type Props = {
  orders: OrderEntry[]
  slug: string
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtRelative(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function OrdersClient({ orders, slug }: Props) {
  const [search, setSearch] = useState('')
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const filtered = useMemo(() => {
    let result = orders

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customerLabel.toLowerCase().includes(q)
      )
    }

    if (fulfillment !== 'all') result = result.filter((o) => o.fulfillment_method === fulfillment)

    return [...result].sort((a, b) => {
      if (sort === 'newest') return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
      if (sort === 'oldest') return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
      if (sort === 'amount_desc') return b.total_amount - a.total_amount
      if (sort === 'amount_asc') return a.total_amount - b.total_amount
      return 0
    })
  }, [orders, search, fulfillment, sort])

  const active = filtered.filter((o) => ACTIVE_STATUSES.has(o.status))
  const past   = filtered.filter((o) => !ACTIVE_STATUSES.has(o.status))
  const hasResults = active.length > 0 || past.length > 0

  // True empty — no orders at all
  if (orders.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <ShoppingBag size={22} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No orders yet</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
          Orders placed by customers will appear here.
        </p>
      </div>
    )
  }

  function OrderRow({ order }: { order: OrderEntry }) {
    const isPending = order.status === 'pending'
    const isDelivery = order.fulfillment_method === 'delivery'

    return (
      <Link
        href={`/business/${slug}/orders/${order.id}`}
        className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors ${
          isPending ? 'border-l-2 border-yellow-400 dark:border-yellow-500 !pl-[14px]' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {order.order_number}
            </p>
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
              isDelivery
                ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
            }`}>
              {isDelivery ? <Truck size={10} /> : <Package size={10} />}
              {isDelivery ? 'Delivery' : 'Pickup'}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
            {order.customerLabel} · {fmtRelative(order.placed_at)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {fmtCurrency(order.total_amount, order.currency)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <ChevronRight size={14} className="text-gray-300 dark:text-neutral-600 shrink-0" />
      </Link>
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
            placeholder="Search by order # or customer…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={fulfillment}
          onChange={(e) => setFulfillment(e.target.value as FulfillmentFilter)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All methods</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
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
          {filtered.length === orders.length
            ? `${orders.length} order${orders.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${orders.length}`}
        </span>
      </div>

      {/* No-results state */}
      {!hasResults && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No orders match your search.</p>
          <button
            onClick={() => { setSearch(''); setFulfillment('all') }}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Active orders */}
      {active.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
            Active · {active.length}
          </h2>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {active.map((o) => <OrderRow key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Past orders */}
      {past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
            Past · {past.length}
          </h2>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {past.map((o) => <OrderRow key={o.id} order={o} />)}
          </div>
        </div>
      )}
    </div>
  )
}
