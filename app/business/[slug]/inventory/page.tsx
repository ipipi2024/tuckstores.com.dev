import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Package,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import InventoryClient, { type StockEntry } from './InventoryClient'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

function fmtStock(qty: number, baseUnit: string): string {
  if (baseUnit === 'unit') return String(Math.round(qty))
  return `${Number(qty).toFixed(3)} ${baseUnit}`
}

export default async function InventoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error, success } = await searchParams
  const ctx = await getBusinessContext(slug)
  const supabase = await createClient()

  const canAdjust = canPerform(ctx.membership.role, 'adjust_inventory')

  const [{ data: stockRows }, { data: allProducts }] = await Promise.all([
    supabase
      .from('product_stock')
      .select(`
        product_id, stock_quantity,
        products ( name, sku, is_active, measurement_type, base_unit, product_categories ( name ) )
      `)
      .eq('business_id', ctx.business.id)
      .order('stock_quantity', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, sku, is_active, measurement_type, base_unit, product_categories ( name )')
      .eq('business_id', ctx.business.id)
      .eq('is_active', true)
      .order('name'),
  ])

  const stockMap = new Map<string, StockEntry>()

  for (const row of stockRows ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    if (!product?.is_active) continue
    const cat = Array.isArray(product.product_categories)
      ? product.product_categories[0]
      : product.product_categories
    stockMap.set(row.product_id, {
      product_id: row.product_id,
      name: product.name,
      sku: product.sku ?? null,
      category: cat?.name ?? null,
      stock_quantity: row.stock_quantity ?? 0,
      base_unit: product.base_unit ?? 'unit',
    })
  }

  for (const p of allProducts ?? []) {
    if (!stockMap.has(p.id)) {
      const cat = Array.isArray(p.product_categories)
        ? p.product_categories[0]
        : p.product_categories
      stockMap.set(p.id, {
        product_id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        category: cat?.name ?? null,
        stock_quantity: 0,
        base_unit: p.base_unit ?? 'unit',
      })
    }
  }

  const entries = Array.from(stockMap.values()).sort((a, b) => a.stock_quantity - b.stock_quantity)

  const total      = entries.length
  const outOfStock = entries.filter((e) => e.stock_quantity <= 0).length
  const lowStock   = entries.filter((e) => e.stock_quantity > 0 && e.stock_quantity <= 5).length
  const inStock    = entries.filter((e) => e.stock_quantity > 5).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={20} />
            Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track and manage your product stock levels.
          </p>
        </div>

        {canAdjust && (
          <Link
            href={`/business/${slug}/inventory/adjust`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <SlidersHorizontal size={14} />
            Adjust inventory
          </Link>
        )}
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          {decodeURIComponent(success)}
        </div>
      )}

      {/* Stat cards */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0">
              <Package size={15} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total products</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <CheckCircle2 size={15} className="text-green-500 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{inStock}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In stock</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
              <TrendingDown size={15} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${lowStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {lowStock}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Low stock</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 flex-shrink-0">
              <XCircle size={15} className="text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${outOfStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {outOfStock}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Out of stock</p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory list */}
      <InventoryClient entries={entries} slug={slug} canAdjust={canAdjust} />
    </div>
  )
}
