'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ImageIcon, Tag, XCircle, AlertTriangle } from 'lucide-react'

export type ProductEntry = {
  id: string
  name: string
  sku: string | null
  category: string | null
  selling_price: number | null
  is_active: boolean
  stock: number
  base_unit: string
  measurement_type: string
  primaryImageUrl: string | null
  currency: string
}

type Props = {
  products: ProductEntry[]
  slug: string
  canManage: boolean
}

type SortKey = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'
type StatusFilter = 'all' | 'active' | 'inactive'

function fmt(price: number | null, currency: string): string {
  if (price === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price)
}

function fmtStock(qty: number, baseUnit: string): string {
  if (baseUnit === 'unit') return String(Math.round(qty))
  return `${Number(qty).toFixed(3)} ${baseUnit}`
}

function ProductThumbnail({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9'
  const iconSize = size === 'lg' ? 18 : 14
  if (url) {
    return (
      <div className={`${dim} rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 flex-shrink-0 bg-gray-50 dark:bg-neutral-800`}>
        <img src={url} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${dim} rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-neutral-800`}>
      <ImageIcon size={iconSize} className="text-gray-300 dark:text-neutral-600" />
    </div>
  )
}

function StockDisplay({ qty, baseUnit }: { qty: number; baseUnit: string }) {
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
        {fmtStock(qty, baseUnit)}
      </span>
    )
  }
  return <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{fmtStock(qty, baseUnit)}</span>
}

export default function ProductsClient({ products, slug, canManage }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('name_asc')

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const p of products) {
      if (p.category) cats.add(p.category)
    }
    return Array.from(cats).sort()
  }, [products])

  const filtered = useMemo(() => {
    let result = products

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
      )
    }

    if (statusFilter === 'active') result = result.filter((p) => p.is_active)
    else if (statusFilter === 'inactive') result = result.filter((p) => !p.is_active)

    if (categoryFilter !== 'all') result = result.filter((p) => p.category === categoryFilter)

    return [...result].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      if (sort === 'price_asc') return (a.selling_price ?? -1) - (b.selling_price ?? -1)
      if (sort === 'price_desc') return (b.selling_price ?? -1) - (a.selling_price ?? -1)
      if (sort === 'stock_asc') return a.stock - b.stock
      if (sort === 'stock_desc') return b.stock - a.stock
      return 0
    })
  }, [products, search, statusFilter, categoryFilter, sort])

  // True empty — no products at all
  if (products.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Tag size={22} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No products yet</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
          Add your first product to start selling and tracking inventory.
        </p>
        {canManage && (
          <Link
            href={`/business/${slug}/products/new`}
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Add your first product
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="stock_asc">Stock: lowest first</option>
          <option value="stock_desc">Stock: highest first</option>
        </select>

        <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto whitespace-nowrap">
          {filtered.length === products.length
            ? `${products.length} product${products.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${products.length}`}
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
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500 text-right">Price</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500 text-right hidden lg:table-cell">Stock</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Status</th>
                  {canManage && <th className="px-4 py-2.5 w-14" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumbnail url={p.primaryImageUrl} name={p.name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white leading-snug">{p.name}</p>
                          {p.sku && (
                            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">#{p.sku}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {p.category ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                      {fmt(p.selling_price, p.currency)}
                      {p.measurement_type !== 'unit' && (
                        <span className="text-xs text-gray-400 dark:text-neutral-500">/{p.base_unit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <StockDisplay qty={p.stock} baseUnit={p.base_unit} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/products/${p.id}`}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Edit
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
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-3"
            >
              <div className="flex items-start gap-3">
                <ProductThumbnail url={p.primaryImageUrl} name={p.name} size="lg" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white leading-snug truncate">
                        {p.name}
                      </p>
                      {(p.sku || p.category) && (
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                          {[p.sku ? `#${p.sku}` : null, p.category].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      p.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50 dark:border-neutral-800">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                        {fmt(p.selling_price, p.currency)}
                        {p.measurement_type !== 'unit' && (
                          <span className="text-xs text-gray-400 dark:text-neutral-500 font-normal">
                            /{p.base_unit}
                          </span>
                        )}
                      </p>
                      <p className={`text-xs tabular-nums mt-0.5 ${
                        p.stock <= 0
                          ? 'text-red-500 dark:text-red-400'
                          : p.stock <= 5
                          ? 'text-amber-500 dark:text-amber-400'
                          : 'text-gray-400 dark:text-neutral-500'
                      }`}>
                        {fmtStock(p.stock, p.base_unit)} in stock
                      </p>
                    </div>
                    {canManage && (
                      <Link
                        href={`/business/${slug}/products/${p.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
