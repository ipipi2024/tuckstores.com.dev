import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, AlertCircle, CheckCircle2, SlidersHorizontal } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function InventoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error, success } = await searchParams
  const ctx = await getBusinessContext(slug)
  const supabase = await createClient()

  const canAdjust = canPerform(ctx.membership.role, 'adjust_inventory')

  // Join product_stock view with products to get names
  const { data: stockRows } = await supabase
    .from('product_stock')
    .select(`
      product_id, stock_quantity,
      products ( name, sku, is_active, product_categories ( name ) )
    `)
    .eq('business_id', ctx.business.id)
    .order('stock_quantity', { ascending: true })

  // Also fetch products with zero / no stock row
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, sku, is_active, product_categories ( name )')
    .eq('business_id', ctx.business.id)
    .eq('is_active', true)
    .order('name')

  type StockEntry = {
    product_id: string
    name: string
    sku: string | null
    category: string | null
    stock_quantity: number
  }

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
      })
    }
  }

  const entries = Array.from(stockMap.values()).sort((a, b) => a.stock_quantity - b.stock_quantity)

  const outOfStock = entries.filter((e) => e.stock_quantity <= 0).length
  const lowStock   = entries.filter((e) => e.stock_quantity > 0 && e.stock_quantity <= 5).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={20} />
            Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {entries.length} product{entries.length !== 1 ? 's' : ''}
            {outOfStock > 0 && (
              <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                · {outOfStock} out of stock
              </span>
            )}
            {lowStock > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                · {lowStock} low
              </span>
            )}
          </p>
        </div>

        {canAdjust && (
          <Link
            href={`/business/${slug}/inventory/adjust`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <SlidersHorizontal size={14} />
            Adjust inventory
          </Link>
        )}
      </div>

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

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Package size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No inventory data yet.</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Add stock via a purchase or use the adjust inventory button above.
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href={`/business/${slug}/purchases/new`}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Record a purchase
              </Link>
              {canAdjust && (
                <>
                  <span className="text-gray-300 dark:text-neutral-600">·</span>
                  <Link
                    href={`/business/${slug}/inventory/adjust`}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Adjust inventory
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Product</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {entries.map((entry) => (
                  <tr key={entry.product_id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {entry.name}
                      {entry.sku && (
                        <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500 font-normal">
                          #{entry.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {entry.category ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={
                        entry.stock_quantity <= 0
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : entry.stock_quantity <= 5
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }>
                        {entry.stock_quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
