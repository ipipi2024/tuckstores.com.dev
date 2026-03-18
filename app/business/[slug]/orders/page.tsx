import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, ChevronRight } from 'lucide-react'

type BusinessCustomer = {
  user_id: string
  display_name_snapshot: string | null
  email_snapshot: string | null
}

type Props = {
  params: Promise<{ slug: string }>
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_STYLE: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  accepted:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  rejected:         'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  preparing:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ready:            'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  out_for_delivery: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  completed:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:        'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
}

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery']

export default async function BusinessOrdersPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_orders')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, placed_at, status, fulfillment_method,
      total_amount, customer_user_id
    `)
    .eq('business_id', ctx.business.id)
    .order('placed_at', { ascending: false })
    .limit(200)

  const allOrders = orders ?? []

  // Batch-fetch business_customers for all orders with a customer
  const customerIds = [...new Set(allOrders.map((o) => o.customer_user_id).filter(Boolean))]
  let customerMap = new Map<string, BusinessCustomer>()
  if (customerIds.length > 0) {
    const { data: bizCustomers } = await supabase
      .from('business_customers')
      .select('user_id, display_name_snapshot, email_snapshot')
      .eq('business_id', ctx.business.id)
      .in('user_id', customerIds)
    for (const bc of bizCustomers ?? []) customerMap.set(bc.user_id, bc)
  }

  const active = allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const past   = allOrders.filter((o) => !ACTIVE_STATUSES.includes(o.status))

  function OrderRow({ order }: { order: (typeof allOrders)[0] }) {
    const bc = order.customer_user_id ? customerMap.get(order.customer_user_id) : undefined
    const customerLabel = bc?.display_name_snapshot ?? bc?.email_snapshot ?? 'Customer'
    return (
      <Link
        href={`/business/${slug}/orders/${order.id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {order.order_number}
            <span className="ml-2 text-xs capitalize text-gray-400 dark:text-neutral-500 font-normal">
              {order.fulfillment_method}
            </span>
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
            {customerLabel} · {fmtDate(order.placed_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {fmtCurrency(order.total_amount, ctx.business.currency_code)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
        <ChevronRight size={15} className="text-gray-300 dark:text-neutral-600 shrink-0" />
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingBag size={20} />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {active.length} active · {past.length} past
          </p>
        </div>
      </div>

      {/* Active orders */}
      {active.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
            Active
          </h2>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {active.map((o) => <OrderRow key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Past orders */}
      {past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
            Past
          </h2>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {past.map((o) => <OrderRow key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {allOrders.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-16 text-center">
          <ShoppingBag size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-400 dark:text-neutral-500">No orders yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            Orders placed by customers will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
