import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Receipt, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { SalesCharts } from './SalesCharts'
import type { DailyData, ChannelData } from './SalesCharts'

type BusinessCustomer = {
  user_id: string
  display_name_snapshot: string | null
  email_snapshot: string | null
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

function fmt(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDatetime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_STYLE: Record<string, string> = {
  completed:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:          'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
  refunded:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partially_refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const CHANNEL_LABEL: Record<string, string> = {
  pos:    'POS',
  manual: 'Manual',
  online: 'Online',
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const positive = value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${
        positive
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500 dark:text-red-400'
      }`}
    >
      <Icon size={12} />
      {positive ? '+' : ''}{value.toFixed(1)}% vs prev 30d
    </span>
  )
}

export default async function SalesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_sales')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const currency = ctx.business.currency_code

  // Date boundaries
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  // Parallel fetch: table sales + analytics window
  const [salesResult, analyticsResult] = await Promise.all([
    supabase
      .from('sales')
      .select(`
        id, created_at, total_amount, sale_channel, status,
        customer_name_snapshot, customer_user_id,
        recorded_by:recorded_by_user_id ( full_name )
      `)
      .eq('business_id', ctx.business.id)
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('sales')
      .select('created_at, total_amount, sale_channel')
      .eq('business_id', ctx.business.id)
      .eq('status', 'completed')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: true }),
  ])

  const sales = salesResult.data
  const analyticsSales = analyticsResult.data ?? []

  // Period split
  const thisPeriod = analyticsSales.filter((s) => new Date(s.created_at) >= thirtyDaysAgo)
  const prevPeriod = analyticsSales.filter((s) => new Date(s.created_at) < thirtyDaysAgo)

  const totalRevenue = thisPeriod.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0)
  const prevRevenue  = prevPeriod.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0)
  const salesCount   = thisPeriod.length
  const prevCount    = prevPeriod.length
  const aov          = salesCount > 0 ? totalRevenue / salesCount : 0
  const prevAov      = prevCount > 0 ? prevRevenue / prevCount : 0

  function trendPct(current: number, prev: number): number | null {
    if (prev === 0) return null
    return ((current - prev) / prev) * 100
  }

  // Build 30-day daily revenue array
  const dailyMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap.set(d.toISOString().split('T')[0], 0)
  }
  for (const s of thisPeriod) {
    const key = s.created_at.split('T')[0]
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(s.total_amount ?? 0))
    }
  }
  const dailyData: DailyData[] = Array.from(dailyMap.entries()).map(([date, revenue]) => ({ date, revenue }))

  // Channel distribution
  const channelMap = new Map<string, { count: number; revenue: number }>()
  for (const s of thisPeriod) {
    const ch  = CHANNEL_LABEL[s.sale_channel] ?? s.sale_channel
    const cur = channelMap.get(ch) ?? { count: 0, revenue: 0 }
    channelMap.set(ch, { count: cur.count + 1, revenue: cur.revenue + Number(s.total_amount ?? 0) })
  }
  const channelData: ChannelData[] = Array.from(channelMap.entries()).map(([channel, d]) => ({ channel, ...d }))

  // Batch-fetch business_customers for online sales without a name snapshot
  const customerIds = [
    ...new Set(
      (sales ?? [])
        .filter((s) => s.customer_user_id && !s.customer_name_snapshot)
        .map((s) => s.customer_user_id as string)
    ),
  ]
  let customerMap = new Map<string, BusinessCustomer>()
  if (customerIds.length > 0) {
    const { data: bizCustomers } = await supabase
      .from('business_customers')
      .select('user_id, display_name_snapshot, email_snapshot')
      .eq('business_id', ctx.business.id)
      .in('user_id', customerIds)
    for (const bc of bizCustomers ?? []) customerMap.set(bc.user_id, bc)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt size={20} />
          Sales
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Overview for the last 30 days
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {fmt(totalRevenue, currency)}
          </p>
          <TrendBadge value={trendPct(totalRevenue, prevRevenue)} />
        </div>

        {/* Sales count */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sales</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {salesCount.toLocaleString()}
          </p>
          <TrendBadge value={trendPct(salesCount, prevCount)} />
        </div>

        {/* AOV */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg. order</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {salesCount > 0 ? fmt(aov, currency) : '—'}
          </p>
          <TrendBadge value={trendPct(aov, prevAov)} />
        </div>

        {/* Top channel */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Top channel</p>
          {channelData.length > 0 ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {channelData.sort((a, b) => b.revenue - a.revenue)[0].channel}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {fmt(channelData[0].revenue, currency)} revenue
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400 dark:text-neutral-600 mt-1">—</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <SalesCharts dailyData={dailyData} channelData={channelData} currency={currency} />

      {/* Recent Sales Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Recent Sales
          </h2>
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {sales?.length ?? 0} record{sales?.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {!sales || sales.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Receipt size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No sales yet.</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                Sales are recorded through the POS.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Customer</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Channel</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Recorded by</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                  {sales.map((s) => {
                    const recorder = Array.isArray(s.recorded_by) ? s.recorded_by[0] : s.recorded_by
                    const bc = s.customer_user_id ? customerMap.get(s.customer_user_id) : undefined
                    const customerLabel = s.customer_name_snapshot
                      ?? bc?.display_name_snapshot
                      ?? bc?.email_snapshot
                      ?? null

                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                          {fmtDatetime(s.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {customerLabel ?? (
                            <span className="text-gray-300 dark:text-neutral-600">Guest</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {CHANNEL_LABEL[s.sale_channel] ?? s.sale_channel}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                          {recorder?.full_name ?? (
                            <span className="text-gray-300 dark:text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums font-medium">
                          {fmt(s.total_amount, currency)}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? STATUS_STYLE.cancelled}`}>
                            {s.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/business/${slug}/sales/${s.id}`}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
