import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart2, Package, TrendingUp, ShoppingCart, Users, Contact, ChevronRight } from 'lucide-react'
import SalesTrendChart from '@/components/SalesTrendChart'
import TopProductsChart from '@/components/TopProductsChart'

type Props = { params: Promise<{ slug: string }> }

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d = new Date()): Date {
  const r = new Date(d)
  r.setDate(1)
  r.setHours(0, 0, 0, 0)
  return r
}

function daysAgo(n: number): Date {
  const r = new Date()
  r.setDate(r.getDate() - n)
  r.setHours(0, 0, 0, 0)
  return r
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_analytics')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const businessId = ctx.business.id
  const currency = ctx.business.currency_code

  const todayISO      = startOfDay().toISOString()
  const monthISO      = startOfMonth().toISOString()
  const thirtyAgoISO  = daysAgo(29).toISOString()
  const ninetyAgoISO  = daysAgo(89).toISOString()

  // ── Parallel queries ───────────────────────────────────────────────────────

  const [
    { data: recentSales },
    { data: saleItemRows },
    { count: allTimeCount },
    { data: stockRows },
    { data: activeProducts },
    { data: monthPurchases },
    { data: topCustomers },
  ] = await Promise.all([
    // Sales last 90 days (for trend, channels, customer insights, summaries)
    supabase
      .from('sales')
      .select('id, created_at, total_amount, sale_channel, customer_user_id')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', ninetyAgoISO)
      .order('created_at'),

    // Sale items last 90 days via inner join (top products)
    supabase
      .from('sale_items')
      .select('product_name_snapshot, quantity, subtotal, sales!inner(business_id, status, created_at)')
      .eq('sales.business_id', businessId)
      .eq('sales.status', 'completed')
      .gte('sales.created_at', ninetyAgoISO),

    // All-time completed sales count (head only — no rows)
    supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'completed'),

    // Stock levels
    supabase
      .from('product_stock')
      .select('product_id, stock_quantity, products ( name, sku, is_active )')
      .eq('business_id', businessId),

    // Active products (to catch zero-stock products not in product_stock)
    supabase
      .from('products')
      .select('id, name, sku')
      .eq('business_id', businessId)
      .eq('is_active', true),

    // Purchases this month
    supabase
      .from('purchases')
      .select('id, total_amount')
      .eq('business_id', businessId)
      .gte('created_at', monthISO),

    // Top customers by total spend (all-time) — includes walk-ins
    supabase
      .from('business_customers')
      .select('id, user_id, display_name_snapshot, email_snapshot, total_spent, completed_sale_count')
      .eq('business_id', businessId)
      .gt('total_spent', 0)
      .order('total_spent', { ascending: false })
      .limit(5),
  ])

  // ── Revenue summary cards ──────────────────────────────────────────────────

  const sales90 = recentSales ?? []

  const todayRevenue = sales90
    .filter((s) => s.created_at >= todayISO)
    .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)

  const monthRevenue = sales90
    .filter((s) => s.created_at >= monthISO)
    .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)

  const totalCount = allTimeCount ?? 0

  const avgBasket = sales90.length > 0
    ? sales90.reduce((sum, s) => sum + (s.total_amount ?? 0), 0) / sales90.length
    : 0

  // ── Sales trend (last 30 days, daily) ─────────────────────────────────────

  const trend30 = sales90.filter((s) => s.created_at >= thirtyAgoISO)
  const trendMap = new Map<string, { revenue: number; sales: number }>()

  // Pre-fill every day in the window so gaps show as zero
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    trendMap.set(key, { revenue: 0, sales: 0 })
  }

  for (const s of trend30) {
    const key = s.created_at.slice(0, 10)
    const entry = trendMap.get(key)
    if (entry) {
      entry.revenue += s.total_amount ?? 0
      entry.sales += 1
    }
  }

  const trendData = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }))

  // ── Top products ───────────────────────────────────────────────────────────

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const item of saleItemRows ?? []) {
    const existing = productMap.get(item.product_name_snapshot)
    if (existing) {
      existing.quantity += item.quantity
      existing.revenue += item.subtotal ?? 0
    } else {
      productMap.set(item.product_name_snapshot, {
        name: item.product_name_snapshot,
        quantity: item.quantity,
        revenue: item.subtotal ?? 0,
      })
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // ── Stock alerts ───────────────────────────────────────────────────────────

  // Build stock map from product_stock view
  const stockMap = new Map<string, number>()
  for (const row of stockRows ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    if (!product?.is_active) continue
    stockMap.set(row.product_id, (stockMap.get(row.product_id) ?? 0) + (row.stock_quantity ?? 0))
  }

  // Find active products with low/no stock
  type StockAlert = { id: string; name: string; sku: string | null; stock: number }
  const stockAlerts: StockAlert[] = []

  for (const p of activeProducts ?? []) {
    const stock = stockMap.get(p.id) ?? 0
    if (stock <= 5) {
      stockAlerts.push({ id: p.id, name: p.name, sku: p.sku ?? null, stock })
    }
  }

  stockAlerts.sort((a, b) => a.stock - b.stock)
  const outOfStockCount = stockAlerts.filter((a) => a.stock <= 0).length
  const lowStockCount = stockAlerts.filter((a) => a.stock > 0 && a.stock <= 5).length

  // ── Channel breakdown ──────────────────────────────────────────────────────

  const channelMap = new Map<string, { count: number; revenue: number }>()
  for (const s of sales90) {
    const ch = s.sale_channel ?? 'unknown'
    const entry = channelMap.get(ch) ?? { count: 0, revenue: 0 }
    entry.count += 1
    entry.revenue += s.total_amount ?? 0
    channelMap.set(ch, entry)
  }

  const channelData = [
    { key: 'pos',    label: 'POS' },
    { key: 'manual', label: 'Manual' },
    { key: 'online', label: 'Online' },
  ]
    .map(({ key, label }) => ({ label, ...(channelMap.get(key) ?? { count: 0, revenue: 0 }) }))
    .filter((c) => c.count > 0)

  // ── Customer insights ──────────────────────────────────────────────────────

  const linkedSales = sales90.filter((s) => s.customer_user_id !== null)
  const guestSales  = sales90.filter((s) => s.customer_user_id === null)

  // Repeat linked customers: count by customer_user_id, pick those with >1 sale
  const customerSaleCount = new Map<string, number>()
  for (const s of linkedSales) {
    if (s.customer_user_id) {
      customerSaleCount.set(s.customer_user_id, (customerSaleCount.get(s.customer_user_id) ?? 0) + 1)
    }
  }
  const repeatCustomerCount = Array.from(customerSaleCount.values()).filter((c) => c > 1).length
  const uniqueLinkedCustomers = customerSaleCount.size

  // ── Purchase summary ───────────────────────────────────────────────────────

  const purchaseCount = monthPurchases?.length ?? 0
  const purchaseSpend = (monthPurchases ?? []).reduce((sum, p) => sum + (p.total_amount ?? 0), 0)

  // ── Format helper ──────────────────────────────────────────────────────────

  function fmt(n: number) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Page title */}
      <div className="flex items-center gap-2">
        <BarChart2 size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
      </div>

      {/* ── Revenue summary cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Today',             value: fmt(todayRevenue),     sub: 'revenue' },
          { label: 'This month',         value: fmt(monthRevenue),     sub: 'revenue' },
          { label: 'Total sales',        value: totalCount.toString(), sub: 'all time' },
          { label: 'Avg basket (90d)',   value: fmt(avgBasket),        sub: 'completed sales' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </section>

      {/* ── Sales trend ── */}
      <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-400" />
          Sales trend — last 30 days
        </h2>
        {trendData.every((d) => d.sales === 0) ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500 py-8 text-center">No sales in the last 30 days.</p>
        ) : (
          <SalesTrendChart daily={trendData} currencyCode={currency} />
        )}
      </section>

      {/* ── Top products + stock alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top products */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <ShoppingCart size={15} className="text-gray-400" />
            Top products — last 90 days
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-500">No sales data yet.</p>
          ) : (
            <TopProductsChart products={topProducts} currencyCode={currency} />
          )}
        </section>

        {/* Stock alerts */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
            <Package size={15} className="text-gray-400" />
            Stock alerts
          </h2>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">
            {outOfStockCount > 0 && <span className="text-red-500 font-medium">{outOfStockCount} out of stock</span>}
            {outOfStockCount > 0 && lowStockCount > 0 && ' · '}
            {lowStockCount > 0 && <span className="text-amber-500 font-medium">{lowStockCount} low (&le;5)</span>}
            {outOfStockCount === 0 && lowStockCount === 0 && 'All products adequately stocked'}
          </p>
          {stockAlerts.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-500">No stock alerts.</p>
          ) : (
            <div className="space-y-2">
              {stockAlerts.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white truncate block">{a.name}</span>
                    {a.sku && <span className="text-xs text-gray-400 dark:text-neutral-500">#{a.sku}</span>}
                  </div>
                  <span className={`ml-3 shrink-0 font-semibold tabular-nums text-sm ${
                    a.stock <= 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {a.stock <= 0 ? 'Out' : a.stock}
                  </span>
                </div>
              ))}
              {stockAlerts.length > 10 && (
                <p className="text-xs text-gray-400 dark:text-neutral-500 pt-1">
                  +{stockAlerts.length - 10} more — <a href={`/business/${slug}/inventory`} className="text-indigo-600 dark:text-indigo-400 hover:underline">view all</a>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Channel breakdown + Customer insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Channel breakdown */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Channel breakdown — last 90 days
          </h2>
          {channelData.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-500">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {channelData.map((ch) => {
                const maxCount = Math.max(...channelData.map((c) => c.count))
                const pct = maxCount > 0 ? (ch.count / maxCount) * 100 : 0
                return (
                  <div key={ch.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">{ch.label}</span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {ch.count} sale{ch.count !== 1 ? 's' : ''} · {fmt(ch.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Customer insights */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            Customer insights — last 90 days
          </h2>
          {sales90.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-500">No sales data yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Guest vs linked */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Guest sales</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">{guestSales.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Linked customer sales</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">{linkedSales.length}</span>
                </div>
                {/* Ratio bar */}
                {sales90.length > 0 && (
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden flex">
                    <div
                      className="h-full bg-indigo-500 dark:bg-indigo-400"
                      style={{ width: `${(linkedSales.length / sales90.length) * 100}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                  {sales90.length > 0
                    ? `${Math.round((linkedSales.length / sales90.length) * 100)}% linked`
                    : '—'}
                </p>
              </div>

              {/* Linked customer stats */}
              {uniqueLinkedCustomers > 0 && (
                <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Unique linked customers</span>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">{uniqueLinkedCustomers}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Repeat customers (2+ sales)</span>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">{repeatCustomerCount}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Top customers ── */}
      {topCustomers && topCustomers.length > 0 && (
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Contact size={15} className="text-gray-400" />
              Top customers — all time
            </h2>
            <a
              href={`/business/${slug}/customers`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              All customers
              <ChevronRight size={12} />
            </a>
          </div>
          <div className="space-y-3">
            {topCustomers.map((c) => {
              const name = c.display_name_snapshot ?? c.email_snapshot ?? 'Unknown'
              const maxSpent = topCustomers[0]?.total_spent ?? 1
              const pct = maxSpent > 0 ? ((c.total_spent ?? 0) / maxSpent) * 100 : 0
              const isRegistered = c.user_id !== null
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isRegistered ? (
                        <a
                          href={`/business/${slug}/customers/${c.user_id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate max-w-[180px]"
                        >
                          {name}
                        </a>
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
                          {name}
                        </span>
                      )}
                      {!isRegistered && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                          Walk-in
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0 ml-3">
                      {fmt(c.total_spent ?? 0)} · {c.completed_sale_count} sale{c.completed_sale_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Purchase summary ── */}
      <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Purchases this month
        </h2>
        {purchaseCount === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No purchases recorded this month.</p>
        ) : (
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Purchase orders</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{purchaseCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total spend</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(purchaseSpend)}</p>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
