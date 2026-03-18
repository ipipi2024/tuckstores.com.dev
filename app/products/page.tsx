import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShoppingBag, Search } from 'lucide-react'

type Props = { searchParams: Promise<{ q?: string; category?: string }> }

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export default async function ProductsPage({ searchParams }: Props) {
  const { q, category } = await searchParams
  const supabase = await createClient()

  // Products with business and category joins — public fields only
  let query = supabase
    .from('products')
    .select(`
      id, name, description, sku, selling_price,
      businesses ( id, name, slug, currency_code ),
      product_categories ( id, name )
    `)
    .order('name', { ascending: true })
    .limit(50) // TODO: add cursor pagination when count exceeds 50

  if (q?.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  if (category) {
    query = query.eq('category_id', category)
  }

  const { data } = await query
  const products = data ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse products across all businesses
          </p>
        </div>

        {/* Search */}
        <form method="get" className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none"
          />
          <input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        {/* Results */}
        {products.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
            <ShoppingBag size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {q ? `No products match "${q}"` : 'No products yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {products.map((p) => {
              const biz = Array.isArray(p.businesses) ? p.businesses[0] : p.businesses
              const cat = Array.isArray(p.product_categories) ? p.product_categories[0] : p.product_categories
              const currency = biz?.currency_code ?? 'USD'
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {biz && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 truncate">{biz.name}</span>
                      )}
                      {cat && (
                        <span className="text-xs text-gray-400 dark:text-neutral-500 truncate">· {cat.name}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmtCurrency(p.selling_price, currency)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
