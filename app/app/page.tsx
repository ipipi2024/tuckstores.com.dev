import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { Receipt, TrendingUp, ShoppingBag, Calendar, Store, ChevronRight } from 'lucide-react'
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

const STATUS_STYLE: Record<string, string> = {
  completed:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:          'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
  refunded:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partially_refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export default async function AppHomePage() {
  const user = await getAuthUser()
  const admin = createAdminClient()

  // Why admin client: we need `businesses(name, currency_code)` for each sale.
  // The `businesses: select for active members` RLS policy blocks non-members from
  // reading business rows — customers are not business members. Admin client bypasses
  // this; ownership is enforced by the explicit .eq('customer_user_id', user.id) filter.
  const { data: sales } = await admin
    .from('sales')
    .select(`
      id, created_at, total_amount, status,
      businesses ( name, currency_code )
    `)
    .eq('customer_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const allSales = sales ?? []
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Stats (completed sales only for spend figures)
  const completedSales = allSales.filter((s) => s.status === 'completed')
  const purchaseCount = completedSales.length

  // Only aggregate spend if all sales share the same currency — avoids mixing ZAR + USD etc.
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

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your purchase history and receipts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400 dark:text-neutral-500">Last 30 days</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {singleCurrency && totalLast30 != null && totalLast30 > 0
              ? fmtCurrency(totalLast30, singleCurrency)
              : !singleCurrency && purchaseCount > 0
              ? <span className="text-base text-gray-400 dark:text-neutral-500">mixed</span>
              : '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400 dark:text-neutral-500">All time</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {singleCurrency && totalAllTime != null && totalAllTime > 0
              ? fmtCurrency(totalAllTime, singleCurrency)
              : !singleCurrency && purchaseCount > 0
              ? <span className="text-base text-gray-400 dark:text-neutral-500">mixed</span>
              : '—'}
          </p>
        </div>

        <div className="col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center gap-3">
          <ShoppingBag size={18} className="text-indigo-500" />
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{purchaseCount}</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500">completed purchase{purchaseCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Browse stores */}
      <Link
        href="/businesses"
        className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Store size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Browse stores</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500">View products and prices</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-400 dark:text-neutral-500" />
      </Link>

      {/* Recent receipts */}
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

        {recentFive.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-8 text-center">
            <Receipt size={28} className="mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-neutral-500">No receipts yet</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Receipts appear here after a business links your account to a sale.
            </p>
          </div>
        ) : (
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
                      {biz?.name ?? 'Unknown business'}
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[sale.status] ?? STATUS_STYLE.cancelled}`}>
                      {sale.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
