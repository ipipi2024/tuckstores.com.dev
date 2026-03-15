import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: supplier }, { data: purchases }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
    supabase
      .from('purchases')
      .select('*, purchase_items(*, products(name))')
      .eq('supplier_id', id)
      .eq('user_id', user.id)
      .order('purchase_date', { ascending: true }),
  ])

  if (!supplier) notFound()

  const totalSpent = purchases?.reduce((sum, p) => sum + Number(p.total_amount ?? 0), 0) ?? 0
  const totalOrders = purchases?.length ?? 0

  // build price history per product
  const priceHistory: Record<string, { name: string; entries: { date: string; cost: number }[] }> = {}
  for (const purchase of purchases ?? []) {
    for (const item of purchase.purchase_items ?? []) {
      const prod = item.products as any
      if (!prod) continue
      if (!priceHistory[item.product_id]) priceHistory[item.product_id] = { name: prod.name, entries: [] }
      priceHistory[item.product_id].entries.push({
        date: purchase.purchase_date,
        cost: Number(item.unit_cost),
      })
    }
  }

  const priceRows = Object.values(priceHistory).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/suppliers" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Suppliers
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{supplier.name}</h1>
        <div className="flex gap-4 mt-1">
          {supplier.phone && <p className="text-sm text-gray-500 dark:text-neutral-400">{supplier.phone}</p>}
          {supplier.email && <p className="text-sm text-gray-500 dark:text-neutral-400">{supplier.email}</p>}
        </div>
        {supplier.notes && <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">{supplier.notes}</p>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Total orders</p>
          <p className="text-2xl font-semibold mt-1">{totalOrders}</p>
        </div>
        <div className="border dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Total purchased</p>
          <p className="text-2xl font-semibold mt-1">R{totalSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Price tracker */}
      {priceRows.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-gray-700 dark:text-neutral-300">Price tracker</h2>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {priceRows.map(({ name, entries }) => {
              const prices = entries.map((e) => e.cost)
              const min = Math.min(...prices)
              const max = Math.max(...prices)
              const latest = prices[prices.length - 1]
              const badge = stabilityBadge(prices)
              return (
                <div key={name} className="border dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{name}</p>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="flex gap-4 text-xs text-gray-500 dark:text-neutral-400">
                      <div>
                        <p>Min</p>
                        <p className="tabular-nums font-medium text-black dark:text-white">R{min.toFixed(2)}</p>
                      </div>
                      <div>
                        <p>Max</p>
                        <p className="tabular-nums font-medium text-black dark:text-white">R{max.toFixed(2)}</p>
                      </div>
                      <div>
                        <p>Latest</p>
                        <p className="tabular-nums font-semibold text-black dark:text-white">R{latest.toFixed(2)}</p>
                      </div>
                    </div>
                    <PriceSparkline prices={prices} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border dark:border-neutral-700 rounded-lg overflow-hidden divide-y dark:divide-neutral-700">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 dark:bg-neutral-800 text-xs text-gray-500 dark:text-neutral-400 font-medium">
              <span>Product</span>
              <span className="text-right">Min</span>
              <span className="text-right">Max</span>
              <span className="text-right">Latest</span>
              <span className="text-right">Trend</span>
            </div>
            {priceRows.map(({ name, entries }) => {
              const prices = entries.map((e) => e.cost)
              const min = Math.min(...prices)
              const max = Math.max(...prices)
              const latest = prices[prices.length - 1]
              const badge = stabilityBadge(prices)
              return (
                <div key={name} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 bg-white dark:bg-neutral-900">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    )}
                  </div>
                  <span className="text-sm tabular-nums text-gray-500 dark:text-neutral-400">R{min.toFixed(2)}</span>
                  <span className="text-sm tabular-nums text-gray-500 dark:text-neutral-400">R{max.toFixed(2)}</span>
                  <span className="text-sm tabular-nums font-semibold">R{latest.toFixed(2)}</span>
                  <PriceSparkline prices={prices} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Purchase history */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700 dark:text-neutral-300">Purchase history</h2>
        {!purchases || purchases.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No purchases recorded for this supplier yet.</p>
        ) : (
          <div className="space-y-3">
            {[...purchases].reverse().map((purchase) => (
              <div key={purchase.id} className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900">
                  <p className="text-sm text-gray-500 dark:text-neutral-400">
                    {new Date(purchase.purchase_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="font-semibold">R{Number(purchase.total_amount ?? 0).toFixed(2)}</p>
                </div>
                {purchase.purchase_items?.length > 0 && (
                  <div className="border-t dark:border-neutral-700 divide-y dark:divide-neutral-700 bg-gray-50 dark:bg-neutral-800">
                    {purchase.purchase_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-700 dark:text-neutral-300">{item.products?.name}</span>
                        <span className="text-gray-500 dark:text-neutral-400">
                          {item.quantity} × R{Number(item.unit_cost).toFixed(2)}
                          {' '}<span className="font-medium text-black dark:text-white">= R{Number(item.subtotal).toFixed(2)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
