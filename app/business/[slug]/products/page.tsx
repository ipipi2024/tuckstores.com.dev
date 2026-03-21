import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Tag, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import ProductsClient, { type ProductEntry } from './ProductsClient'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)
  const canManage = canPerform(ctx.membership.role, 'manage_products')
  const supabase = await createClient()

  const [{ data: products }, { data: stockRows }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, sku, selling_price, is_active,
        measurement_type, base_unit,
        product_categories ( name ),
        product_images ( id, url, position )
      `)
      .eq('business_id', ctx.business.id)
      .order('name'),
    supabase
      .from('product_stock')
      .select('product_id, stock_quantity')
      .eq('business_id', ctx.business.id),
  ])

  // Aggregate stock per product across locations
  const stockMap = new Map<string, number>()
  for (const row of stockRows ?? []) {
    stockMap.set(row.product_id, (stockMap.get(row.product_id) ?? 0) + (row.stock_quantity ?? 0))
  }

  const entries: ProductEntry[] = (products ?? []).map((p) => {
    const cat = Array.isArray(p.product_categories) ? p.product_categories[0] : p.product_categories
    const images = Array.isArray(p.product_images) ? p.product_images : []
    const primaryImage = images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] ?? null

    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      category: cat?.name ?? null,
      selling_price: p.selling_price ?? null,
      is_active: p.is_active ?? true,
      stock: stockMap.get(p.id) ?? 0,
      base_unit: p.base_unit ?? 'unit',
      measurement_type: p.measurement_type ?? 'unit',
      primaryImageUrl: primaryImage?.url ?? null,
      currency: ctx.business.currency_code,
    }
  })

  const total    = entries.length
  const active   = entries.filter((p) => p.is_active).length
  const inactive = entries.filter((p) => !p.is_active).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag size={20} />
            Products
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your product catalogue, pricing, and images.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/business/${slug}/products/new`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add product
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Stat cards */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0">
              <Tag size={15} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <CheckCircle2 size={15} className="text-green-500 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{active}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
              <XCircle size={15} className={inactive > 0 ? 'text-gray-500 dark:text-neutral-400' : 'text-gray-400 dark:text-neutral-500'} />
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${inactive > 0 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-900 dark:text-white'}`}>
                {inactive}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inactive</p>
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      <ProductsClient products={entries} slug={slug} canManage={canManage} />
    </div>
  )
}
