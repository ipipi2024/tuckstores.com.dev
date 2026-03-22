import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Contact, ChevronRight, Users, UserCheck, UserX, TrendingUp } from 'lucide-react'
import { CustomersCharts } from './CustomersCharts'
import type { TrendPoint, SpenderPoint } from './CustomersCharts'

type Props = { params: Promise<{ slug: string }> }

function fmt(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style:              'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  })
}

export default async function CustomersPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_customers')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const currency = ctx.business.currency_code

  const { data: customers } = await supabase
    .from('business_customers')
    .select(`
      id,
      user_id,
      display_name_snapshot,
      email_snapshot,
      phone_snapshot,
      order_count,
      completed_order_count,
      completed_sale_count,
      total_spent,
      first_interaction_at,
      last_interaction_at
    `)
    .eq('business_id', ctx.business.id)
    .order('last_interaction_at', { ascending: false })
    .limit(500)

  const list = customers ?? []

  // ── KPI metrics ────────────────────────────────────────────────────────────
  const registeredCount = list.filter((c) => c.user_id !== null).length
  const walkinCount     = list.filter((c) => c.user_id === null).length
  const totalRevenue    = list.reduce((sum, c) => sum + Number(c.total_spent ?? 0), 0)
  const avgSpend        = list.length > 0 ? totalRevenue / list.length : 0

  // ── Monthly new customers trend (last 6 months) ─────────────────────────
  const now      = new Date()
  const monthMap = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0)
  }
  for (const c of list) {
    if (!c.first_interaction_at) continue
    const d   = new Date(c.first_interaction_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
  }
  const trendData: TrendPoint[] = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

  // ── Top spenders ──────────────────────────────────────────────────────────
  const topSpenders: SpenderPoint[] = [...list]
    .filter((c) => Number(c.total_spent ?? 0) > 0)
    .sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))
    .slice(0, 10)
    .map((c) => ({
      name:     c.display_name_snapshot ?? c.email_snapshot ?? 'Unknown',
      revenue:  Number(c.total_spent ?? 0),
      isWalkin: c.user_id === null,
    }))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Contact size={20} />
          Customers
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {list.length} customer{list.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-indigo-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{list.length}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck size={14} className="text-indigo-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Registered</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{registeredCount}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <UserX size={14} className="text-amber-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Walk-ins</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{walkinCount}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg. spend</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {list.length > 0 ? fmt(avgSpend, currency) : '—'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <CustomersCharts
        trendData={trendData}
        topSpenders={topSpenders}
        currency={currency}
        registeredCount={registeredCount}
        walkinCount={walkinCount}
      />

      {/* Customers Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All customers</h2>
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {fmt(totalRevenue, currency)} total revenue
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {list.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Contact size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No customers yet.</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                Customers appear here when they place an online order or are recorded during a POS sale.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Contact</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell text-right">Total spent</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell text-right">Sales</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Last seen</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                  {list.map((c) => {
                    const href = c.user_id !== null
                      ? `/business/${slug}/customers/${c.user_id}`
                      : `/business/${slug}/customers/walkin/${c.id}`

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                              {c.display_name_snapshot ?? c.email_snapshot ?? 'Unknown'}
                            </p>
                            {c.user_id === null && (
                              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                Walk-in
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          <p className="truncate max-w-[180px]">{c.email_snapshot ?? '—'}</p>
                          {c.phone_snapshot && (
                            <p className="text-xs text-gray-400 dark:text-neutral-500">{c.phone_snapshot}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums font-medium hidden md:table-cell">
                          {fmt(c.total_spent, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums hidden lg:table-cell">
                          {c.completed_sale_count}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell whitespace-nowrap">
                          {fmtDate(c.last_interaction_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            View
                            <ChevronRight size={12} />
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
