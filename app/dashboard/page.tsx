import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'

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

  // aggregate top products by revenue
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white underline"
          >
            Sign out
          </button>
        </form>
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

      {/* Nav links */}
      <div className="grid grid-cols-1 gap-3">
        <Link
          href="/dashboard/pos"
          className="flex items-center justify-between p-4 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <div>
            <p className="font-semibold">Point of Sale</p>
            <p className="text-sm text-gray-300 dark:text-gray-700">Tap products to record a sale fast</p>
          </div>
          <span className="text-gray-400 dark:text-gray-600">→</span>
        </Link>
        <Link
          href="/dashboard/products"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Products</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Manage your product catalogue</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
        <Link
          href="/dashboard/purchases"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Purchases</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Record stock coming in and track inventory</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
        <Link
          href="/dashboard/inventory"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Inventory</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">View current stock levels and movement log</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
        <Link
          href="/dashboard/sales"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Sales</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Record sales and update inventory</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
        <Link
          href="/dashboard/customers"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Customers</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Manage customers and view purchase history</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
        <Link
          href="/dashboard/suppliers"
          className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <div>
            <p className="font-medium">Suppliers</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Manage suppliers and view order history</p>
          </div>
          <span className="text-gray-400 dark:text-neutral-500">→</span>
        </Link>
      </div>
    </div>
  )
}
