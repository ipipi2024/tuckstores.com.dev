import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Contact, ShoppingBag, Package } from 'lucide-react'

type Props = { params: Promise<{ slug: string; userId: string }> }

function fmt(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

export default async function CustomerDetailPage({ params }: Props) {
  const { slug, userId } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_customers')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const businessId = ctx.business.id
  const currency = ctx.business.currency_code

  // Fetch the business_customers record (proves this user is a customer of this business)
  const { data: customer } = await supabase
    .from('business_customers')
    .select(`
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
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!customer) {
    notFound()
  }

  // Parallel: recent sales + top products
  const [{ data: recentSales }, { data: topProducts }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, created_at, total_amount, sale_channel, status')
      .eq('business_id', businessId)
      .eq('customer_user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('business_customer_products')
      .select('purchase_count, total_spent, last_purchased_at, products ( id, name, sku )')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .order('purchase_count', { ascending: false })
      .limit(10),
  ])

  const displayName = customer.display_name_snapshot ?? customer.email_snapshot ?? 'Unknown'

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href={`/business/${slug}/customers`}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Contact size={20} />
          {displayName}
        </h1>
      </div>

      {/* Profile + metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Profile card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Profile</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-400 dark:text-neutral-500 w-14 shrink-0">Name</span>
              <span className="text-gray-900 dark:text-white font-medium">{displayName}</span>
            </div>
            {customer.email_snapshot && (
              <div className="flex gap-2">
                <span className="text-gray-400 dark:text-neutral-500 w-14 shrink-0">Email</span>
                <span className="text-gray-700 dark:text-gray-300 break-all">{customer.email_snapshot}</span>
              </div>
            )}
            {customer.phone_snapshot && (
              <div className="flex gap-2">
                <span className="text-gray-400 dark:text-neutral-500 w-14 shrink-0">Phone</span>
                <span className="text-gray-700 dark:text-gray-300">{customer.phone_snapshot}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-400 dark:text-neutral-500 w-14 shrink-0">Since</span>
              <span className="text-gray-700 dark:text-gray-300">{fmtDate(customer.first_interaction_at)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 dark:text-neutral-500 w-14 shrink-0">Last seen</span>
              <span className="text-gray-700 dark:text-gray-300">{fmtDate(customer.last_interaction_at)}</span>
            </div>
          </div>
        </div>

        {/* Metrics card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Activity</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total spent',   value: fmt(customer.total_spent, currency) },
              { label: 'Completed sales', value: customer.completed_sale_count.toString() },
              { label: 'Orders placed', value: customer.order_count.toString() },
              { label: 'Orders completed', value: customer.completed_order_count.toString() },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Package size={15} className="text-gray-400" />
          Favourite products
        </h2>
        {!topProducts || topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No product data yet.</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((row) => {
              const product = Array.isArray(row.products) ? row.products[0] : row.products
              if (!product) return null
              return (
                <div key={product.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <Link
                      href={`/business/${slug}/products/${product.id}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block"
                    >
                      {product.name}
                    </Link>
                    {product.sku && (
                      <span className="text-xs text-gray-400 dark:text-neutral-500">#{product.sku}</span>
                    )}
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                      {fmt(row.total_spent, currency)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500">
                      {row.purchase_count} time{row.purchase_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent sales */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          <ShoppingBag size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent sales</h2>
        </div>
        {!recentSales || recentSales.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 dark:text-neutral-500 text-center">No completed sales recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Channel</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Total</th>
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
