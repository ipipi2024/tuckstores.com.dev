import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { Receipt, TrendingUp, ShoppingBag, Calendar, Store, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const RECEIPT_STATUS_STYLE: Record<string, string> = {
  completed:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:          'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
  refunded:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partially_refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  accepted:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  preparing:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ready:            'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  out_for_delivery: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending:          'Pending confirmation',
  accepted:         'Accepted',
  preparing:        'Being prepared',
  ready:            'Ready for pickup',
  out_for_delivery: 'Out for delivery',
}

export default async function AppHomePage() {
  const user = await getAuthUser()
  const admin = createAdminClient()

  // Fetch sales and active orders in parallel.
  // Admin client used for both: businesses RLS blocks non-members from reading
  // business rows; ownership enforced by .eq('customer_user_id', user.id).
  const [salesResult, activeOrdersResult] = await Promise.all([
    admin
      .from('sales')
      .select('id, created_at, total_amount, status, businesses ( name, currency_code )')
      .eq('customer_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('orders')
      .select('id, order_number, status, businesses ( name )')
      .eq('customer_user_id', user.id)
      .in('status', ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'])
      .order('placed_at', { ascending: false })
      .limit(3),
  ])

  const allSales = salesResult.data ?? []
  const activeOrders = activeOrdersResult.data ?? []

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Stats — completed sales only
  const completedSales = allSales.filter((s) => s.status === 'completed')
  const purchaseCount = completedSales.length

  const currencies = [...new Set(completedSales.map((s) => {
    const biz = Array.isArray(s.businesses) ? s.businesses[0] : s.businesses
    return biz?.currency_code ?? 'USD'
  }))]
  const singleCurrency = currencies.length === 1 ? currencies[0] : null

  const totalAllTime = singleCurrency
    ? completedSales.reduce((sum, s) => sum + (s.total_amount ?? 0), 0)
    : null
  const totalLast30 = singleCurrency
    ? completedSales
        .filter((s) => new Date(s.created_at) >= thirtyDaysAgo)
        .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)
    : null

  const recentFive = allSales.slice(0, 5)
  const isNewUser = allSales.length === 0 && activeOrders.length === 0

  // ── New-user experience ─────────────────────────────────────────────────────
  if (isNewUser) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{greeting()}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Welcome to TuckStores
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/businesses"
          className="flex items-center gap-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-5 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Store size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base">Explore stores</p>
            <p className="text-sm text-indigo-200 mt-0.5">Browse products and prices near you</p>
          </div>
          <ChevronRight size={18} className="text-indigo-300 shrink-0" />
        </Link>

        {/* Empty state */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-10 text-center space-y-2">
          <ShoppingBag size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-1" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No activity yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 max-w-xs mx-auto leading-relaxed">
            Your orders and receipts will appear here once you start shopping.
          </p>
        </div>
      </div>
    )
  }

  // ── Returning-user experience ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{greeting()}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Here&apos;s what&apos;s happening
        </p>
      </div>

      {/* Active orders — shown prominently when present */}
      {activeOrders.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
              <Clock size={12} />
              Active orders · {activeOrders.length}
            </h3>
            <Link href="/app/orders" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {activeOrders.map((order) => {
              const biz = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses
              return (
                <Link
                  key={order.id}
                  href={`/app/orders/${order.id}`}
                  className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-4 py-3.5 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {biz?.name ?? 'Unknown store'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {order.order_number}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${ORDER_STATUS_STYLE[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ORDER_STATUS_LABEL[order.status] ?? order.status.replace(/_/g, ' ')}
                  </span>
                  <ChevronRight size={14} className="text-gray-300 dark:text-neutral-600 shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Explore stores CTA */}
      <Link
        href="/businesses"
        className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3.5 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
          <Store size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Explore stores</p>
          <p className="text-xs text-indigo-200 mt-0.5">Browse products and prices</p>
        </div>
        <ChevronRight size={16} className="text-indigo-300 shrink-0" />
      </Link>

      {/* Stats — only shown when there is real spend data */}
      {purchaseCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400 dark:text-neutral-500">Last 30 days</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              {singleCurrency && totalLast30 != null && totalLast30 > 0
                ? fmtCurrency(totalLast30, singleCurrency)
                : !singleCurrency
                ? <span className="text-base text-gray-400 dark:text-neutral-500">mixed</span>
                : '—'}
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400 dark:text-neutral-500">All time</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              {singleCurrency && totalAllTime != null && totalAllTime > 0
                ? fmtCurrency(totalAllTime, singleCurrency)
                : !singleCurrency
                ? <span className="text-base text-gray-400 dark:text-neutral-500">mixed</span>
                : '—'}
            </p>
          </div>

          <div className="col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center gap-3">
            <ShoppingBag size={18} className="text-indigo-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{purchaseCount}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500">
                completed purchase{purchaseCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent receipts */}
      {recentFive.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Receipt size={14} className="text-gray-400" />
              Recent receipts
            </h3>
            {allSales.length > 5 && (
              <Link href="/app/receipts" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                View all
              </Link>
            )}
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {recentFive.map((sale) => {
              const biz = Array.isArray(sale.businesses) ? sale.businesses[0] : sale.businesses
              return (
                <Link
                  key={sale.id}
                  href={`/app/receipts/${sale.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {biz?.name ?? 'Unknown store'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {fmtDate(sale.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {sale.total_amount != null
                        ? fmtCurrency(sale.total_amount, biz?.currency_code ?? 'USD')
                        : '—'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECEIPT_STATUS_STYLE[sale.status] ?? RECEIPT_STATUS_STYLE.cancelled}`}>
                      {sale.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
