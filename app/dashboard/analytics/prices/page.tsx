import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PriceSparkline from '@/components/PriceSparkline'

function stabilityBadge(prices: number[]) {
  if (prices.length < 2) return null
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length
  const variance = prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length
  const cv = (Math.sqrt(variance) / mean) * 100
  if (cv < 5)  return { label: 'Stable',   cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  if (cv < 15) return { label: 'Variable', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
  return       { label: 'Volatile',  cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
}

export default async function PriceTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: purchaseItems } = await supabase
    .from('purchase_items')
    .select('unit_cost, product_id, products(name), purchases(purchase_date, supplier_id, user_id, suppliers(id, name))')
    .eq('purchases.user_id', user.id)
    .order('purchases(purchase_date)', { ascending: true })

  // group by product → supplier → price entries
  type Entry = { date: string; cost: number }
  type SupplierPrices = { supplierId: string; supplierName: string; entries: Entry[] }
  const byProduct: Record<string, { name: string; suppliers: Record<string, SupplierPrices> }> = {}

  for (const item of purchaseItems ?? []) {
    const purchase = item.purchases as any
    if (!purchase || purchase.user_id !== user.id) continue
    const supplier = purchase.suppliers as any
    if (!supplier) continue
    const prod = item.products as any
    if (!prod) continue

    if (!byProduct[item.product_id]) byProduct[item.product_id] = { name: prod.name, suppliers: {} }
    if (!byProduct[item.product_id].suppliers[supplier.id]) {
      byProduct[item.product_id].suppliers[supplier.id] = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        entries: [],
      }
    }
    byProduct[item.product_id].suppliers[supplier.id].entries.push({
      date: purchase.purchase_date,
      cost: Number(item.unit_cost),
    })
  }

  const products = Object.entries(byProduct)
    .map(([id, { name, suppliers }]) => ({
      id, name,
      suppliers: Object.values(suppliers),
    }))
    .filter((p) => p.suppliers.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/analytics" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Analytics
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Price tracker</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">Compare supplier prices per product across all purchases</p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-neutral-500">No purchase data yet.</p>
      ) : (
        <div className="space-y-6">
          {products.map((product) => {
            // find cheapest supplier by latest price
            const cheapest = [...product.suppliers].sort((a, b) => {
              const aLatest = a.entries[a.entries.length - 1].cost
              const bLatest = b.entries[b.entries.length - 1].cost
              return aLatest - bLatest
            })[0]

            return (
              <div key={product.id} className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                {/* Product header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-800 flex items-center justify-between">
                  <h2 className="font-medium text-sm">{product.name}</h2>
                  {product.suppliers.length > 1 && (
                    <span className="text-xs text-gray-500 dark:text-neutral-400">
                      Best price: <span className="font-semibold text-green-600 dark:text-green-400">{cheapest.supplierName}</span>
                    </span>
                  )}
                </div>

                {/* Supplier rows */}
                <div className="divide-y dark:divide-neutral-700">
                  {product.suppliers
                    .sort((a, b) => a.entries[a.entries.length - 1].cost - b.entries[b.entries.length - 1].cost)
                    .map((sup) => {
                      const prices = sup.entries.map((e) => e.cost)
                      const latest = prices[prices.length - 1]
                      const min = Math.min(...prices)
                      const max = Math.max(...prices)
                      const badge = stabilityBadge(prices)
                      const isCheapest = product.suppliers.length > 1 && sup.supplierId === cheapest.supplierId

                      return (
                        <div key={sup.supplierId} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 bg-white dark:bg-neutral-900 ${isCheapest ? 'border-l-2 border-green-500' : ''}`}>
                          <div className="min-w-0">
                            <Link href={`/dashboard/suppliers/${sup.supplierId}`} className="text-sm font-medium hover:underline truncate block">
                              {sup.supplierName}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400 dark:text-neutral-500">{sup.entries.length} purchase{sup.entries.length !== 1 ? 's' : ''}</span>
                              {badge && <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                              {isCheapest && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Cheapest</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Min</p>
                            <p className="text-sm tabular-nums">R{min.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Max</p>
                            <p className="text-sm tabular-nums">R{max.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Latest</p>
                            <p className="text-sm tabular-nums font-semibold">R{latest.toFixed(2)}</p>
                          </div>
                          <PriceSparkline prices={prices} />
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
