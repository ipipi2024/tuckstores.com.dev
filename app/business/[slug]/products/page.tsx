import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Tag, AlertCircle } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

function fmt(price: number | null, currency: string): string {
  if (price === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price)
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)
  const canManage = canPerform(ctx.membership.role, 'manage_products')
  const supabase = await createClient()

  // Fetch products with categories
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, sku, selling_price, cost_price_default, is_active, created_at,
      product_categories ( name )
    `)
    .eq('business_id', ctx.business.id)
    .order('name')

  // Fetch stock for all products in this business (sum across all locations)
  const { data: stockRows } = await supabase
    .from('product_stock')
    .select('product_id, stock_quantity')
    .eq('business_id', ctx.business.id)

  // Aggregate stock per product across locations
  const stockMap = new Map<string, number>()
  for (const row of stockRows ?? []) {
    stockMap.set(row.product_id, (stockMap.get(row.product_id) ?? 0) + (row.stock_quantity ?? 0))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag size={20} />
            Products
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {products?.length ?? 0} product{products?.length !== 1 ? 's' : ''}
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

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!products || products.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Tag size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No products yet.</p>
            {canManage && (
              <Link
                href={`/business/${slug}/products/new`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus size={13} />
                Add your first product
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Stock</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {products.map((p) => {
                  const stock = stockMap.get(p.id) ?? 0
                  const cat = Array.isArray(p.product_categories)
                    ? p.product_categories[0]
                    : p.product_categories
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {p.name}
                        {p.sku && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500 font-normal">
                            #{p.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {cat?.name ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                        {fmt(p.selling_price, ctx.business.currency_code)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            stock <= 0
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : stock <= 5
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : 'text-gray-700 dark:text-gray-300'
                          }
                        >
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/business/${slug}/products/${p.id}`}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
