import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: todaySales },
    { data: monthSales },
    { data: lowStock },
    { data: topItems },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount')
      .eq('user_id', user.id)
      .gte('created_at', todayStart),
    supabase
      .from('sales')
      .select('total_amount')
      .eq('user_id', user.id)
      .gte('created_at', monthStart),
    supabase
      .from('product_stock')
      .select('product_id, stock_quantity, products(name)')
      .lte('stock_quantity', 5),
    supabase
      .from('sale_items')
      .select('subtotal, products(id, name)')
      .limit(2000),
  ])

  const todayRevenue = todaySales?.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) ?? 0
  const monthRevenue = monthSales?.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) ?? 0
  const todaySalesCount = todaySales?.length ?? 0

  const revenueByProduct: Record<string, { name: string; revenue: number }> = {}
  for (const item of topItems ?? []) {
    const prod = item.products as any
    if (!prod) continue
    if (!revenueByProduct[prod.id]) revenueByProduct[prod.id] = { name: prod.name, revenue: 0 }
    revenueByProduct[prod.id].revenue += Number(item.subtotal ?? 0)
  }
  const topProducts = Object.values(revenueByProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const lowStockItems = (lowStock ?? []).filter((r) => (r.products as any)?.name)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">{user.email}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900">
          <p className="text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wide">Today's revenue</p>
          <p className="text-2xl font-semibold mt-1">R{todayRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{todaySalesCount} sale{todaySalesCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="border dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900">
          <p className="text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wide">This month</p>
          <p className="text-2xl font-semibold mt-1">R{monthRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{monthSales?.length ?? 0} sales</p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            ⚠ Low stock — {lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} running low
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((row: any) => (
              <span
                key={row.product_id}
                className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              >
                {row.products.name} — {row.stock_quantity} left
              </span>
            ))}
          </div>
          <Link href="/dashboard/inventory" className="text-xs text-amber-700 dark:text-amber-400 underline">
            View inventory →
          </Link>
        </div>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Top products</h2>
          <div className="border dark:border-neutral-700 rounded-lg overflow-hidden divide-y dark:divide-neutral-700">
            {topProducts.map((p, i) => {
              const maxRevenue = topProducts[0].revenue
              const pct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0
              return (
                <div key={p.name} className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-neutral-900">
                  <span className="text-xs text-gray-400 dark:text-neutral-500 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                      <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">R{p.revenue.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
