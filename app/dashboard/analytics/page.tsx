import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SalesTrendChart from '@/components/SalesTrendChart'
import TopProductsChart from '@/components/TopProductsChart'
import CategoryBreakdownChart from '@/components/CategoryBreakdownChart'
import CustomerInsights from '@/components/CustomerInsights'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const from = new Date()
  from.setDate(from.getDate() - 89)
  from.setHours(0, 0, 0, 0)

  const [{ data: sales }, { data: saleItems }, { data: categoryItems }, { data: customerSales }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total_amount, created_at')
      .eq('user_id', user.id)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('sale_items')
      .select('product_id, quantity, subtotal, products(name), sales(created_at, user_id)')
      .eq('sales.user_id', user.id),
    supabase
      .from('sale_items')
      .select('quantity, subtotal, products(id, name, product_categories(name)), sales(user_id)')
      .eq('sales.user_id', user.id),
    supabase
      .from('sales')
      .select('id, total_amount, created_at, customer_id, customers(id, name)')
      .eq('user_id', user.id)
      .not('customer_id', 'is', null),
  ])

  // ── daily revenue ────────────────────────────────────────────────
  const byDate: Record<string, { revenue: number; sales: number }> = {}
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    byDate[d.toISOString().slice(0, 10)] = { revenue: 0, sales: 0 }
  }
  for (const sale of sales ?? []) {
    const key = sale.created_at.slice(0, 10)
    if (!byDate[key]) byDate[key] = { revenue: 0, sales: 0 }
    byDate[key].revenue += Number(sale.total_amount ?? 0)
    byDate[key].sales += 1
  }
  const daily = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  // ── top products ─────────────────────────────────────────────────
  const byProduct: Record<string, { name: string; revenue: number; quantity: number }> = {}
  for (const item of saleItems ?? []) {
    const prod = item.products as any
    const sale = item.sales as any
    if (!prod || sale?.user_id !== user.id) continue
    if (!byProduct[item.product_id]) byProduct[item.product_id] = { name: prod.name, revenue: 0, quantity: 0 }
    byProduct[item.product_id].revenue += Number(item.subtotal ?? 0)
    byProduct[item.product_id].quantity += Number(item.quantity ?? 0)
  }
  const topProducts = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // ── category breakdown ───────────────────────────────────────────
  const byCategory: Record<string, { name: string; revenue: number; quantity: number }> = {}
  for (const item of categoryItems ?? []) {
    const prod = item.products as any
    const sale = item.sales as any
    if (!prod || sale?.user_id !== user.id) continue
    const catName = prod.product_categories?.name ?? 'Uncategorised'
    if (!byCategory[catName]) byCategory[catName] = { name: catName, revenue: 0, quantity: 0 }
    byCategory[catName].revenue += Number(item.subtotal ?? 0)
    byCategory[catName].quantity += Number(item.quantity ?? 0)
  }
  const categories = Object.values(byCategory).sort((a, b) => b.revenue - a.revenue)

  // ── customer insights ────────────────────────────────────────────
  const byCustomer: Record<string, { id: string; name: string; totalSpent: number; visits: number; lastVisit: string }> = {}
  for (const sale of customerSales ?? []) {
    const customer = sale.customers as any
    if (!customer) continue
    if (!byCustomer[customer.id]) {
      byCustomer[customer.id] = { id: customer.id, name: customer.name, totalSpent: 0, visits: 0, lastVisit: sale.created_at }
    }
    byCustomer[customer.id].totalSpent += Number(sale.total_amount ?? 0)
    byCustomer[customer.id].visits += 1
    if (sale.created_at > byCustomer[customer.id].lastVisit) byCustomer[customer.id].lastVisit = sale.created_at
  }
  const topCustomers = Object.values(byCustomer)
    .map((c) => ({ ...c, avgBasket: c.visits > 0 ? c.totalSpent / c.visits : 0 }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 8)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">Last 90 days</p>
        </div>
        <Link href="/dashboard/analytics/prices" className="text-sm text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white border dark:border-neutral-700 px-3 py-1.5 rounded-md transition-colors">
          Price tracker →
        </Link>
      </div>

      <div className="border dark:border-neutral-700 rounded-lg p-5 bg-white dark:bg-neutral-900 space-y-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Revenue trend</h2>
        <SalesTrendChart daily={daily} />
      </div>

      <div className="border dark:border-neutral-700 rounded-lg p-5 bg-white dark:bg-neutral-900 space-y-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Top products</h2>
        <TopProductsChart products={topProducts} />
      </div>

      <div className="border dark:border-neutral-700 rounded-lg p-5 bg-white dark:bg-neutral-900 space-y-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Sales by category</h2>
        <CategoryBreakdownChart categories={categories} />
      </div>

      <div className="border dark:border-neutral-700 rounded-lg p-5 bg-white dark:bg-neutral-900 space-y-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Top customers</h2>
        <CustomerInsights customers={topCustomers} />
      </div>
    </div>
  )
}
