import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, Phone, User, Calendar } from 'lucide-react'

type Props = { params: Promise<{ slug: string; id: string }> }

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

function fmtDatetime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
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

export default async function WalkinCustomerDetailPage({ params }: Props) {
  const { slug, id } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_customers')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase   = await createClient()
  const businessId = ctx.business.id
  const currency   = ctx.business.currency_code

  // Fetch the business_customers record by its own UUID (not user_id)
  const { data: customer } = await supabase
    .from('business_customers')
    .select(`
      id,
      user_id,
      display_name_snapshot,
      email_snapshot,
      phone_snapshot,
      completed_sale_count,
      total_spent,
      first_interaction_at,
      last_interaction_at
    `)
    .eq('business_id', businessId)
    .eq('id', id)
    .is('user_id', null)        // must be a walk-in record
    .maybeSingle()

  if (!customer) notFound()

  // Fetch related sales — match by phone (preferred) or name+no-phone
  let salesQuery = supabase
    .from('sales')
    .select('id, created_at, total_amount, sale_channel, status')
    .eq('business_id', businessId)
    .is('customer_user_id', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (customer.phone_snapshot) {
    salesQuery = salesQuery.eq('customer_phone_snapshot', customer.phone_snapshot)
  } else if (customer.display_name_snapshot) {
    salesQuery = salesQuery
      .eq('customer_name_snapshot', customer.display_name_snapshot)
      .is('customer_phone_snapshot', null)
  }

  const { data: recentSales } = await salesQuery

  const displayName = customer.display_name_snapshot ?? 'Walk-in customer'

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link
          href={`/business/${slug}/customers`}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {displayName}
            </h1>
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Walk-in
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            No platform account · POS only
          </p>
        </div>
      </div>

      {/* Profile + metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Profile */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Profile
          </h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-3">
              <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">Name</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {customer.display_name_snapshot ?? <span className="text-gray-400 dark:text-neutral-500 italic">Not recorded</span>}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">Phone</p>
                <p className="text-gray-900 dark:text-white">
                  {customer.phone_snapshot ?? <span className="text-gray-400 dark:text-neutral-500 italic">Not recorded</span>}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">First visit</p>
                <p className="text-gray-900 dark:text-white">{fmtDate(customer.first_interaction_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">Last visit</p>
                <p className="text-gray-900 dark:text-white">{fmtDate(customer.last_interaction_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Activity
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total spent</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {fmt(customer.total_spent, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Completed sales</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {customer.completed_sale_count}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Avg. per visit</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {customer.completed_sale_count > 0
                  ? fmt(Number(customer.total_spent ?? 0) / customer.completed_sale_count, currency)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Channel</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">POS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          <ShoppingBag size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sales history</h2>
          {recentSales && recentSales.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 dark:text-neutral-500">
              {recentSales.length} record{recentSales.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!recentSales || recentSales.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 dark:text-neutral-500 text-center">
            No sales found for this customer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Channel</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {recentSales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                      {fmtDatetime(s.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {CHANNEL_LABEL[s.sale_channel] ?? s.sale_channel}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
