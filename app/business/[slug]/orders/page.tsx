import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShoppingBag, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import OrdersClient, { type OrderEntry } from './OrdersClient'

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
    .select('id, order_number, placed_at, status, fulfillment_method, total_amount, customer_user_id')
    .eq('business_id', ctx.business.id)
    .order('placed_at', { ascending: false })
    .limit(200)

  const allOrders = orders ?? []

  // Batch-fetch business_customers for customer labels
  const customerIds = [...new Set(allOrders.map((o) => o.customer_user_id).filter(Boolean))]
  const customerMap = new Map<string, BusinessCustomer>()
  if (customerIds.length > 0) {
    const { data: bizCustomers } = await supabase
      .from('business_customers')
      .select('user_id, display_name_snapshot, email_snapshot')
      .eq('business_id', ctx.business.id)
      .in('user_id', customerIds)
    for (const bc of bizCustomers ?? []) customerMap.set(bc.user_id, bc)
  }

  const entries: OrderEntry[] = allOrders.map((o) => {
    const bc = o.customer_user_id ? customerMap.get(o.customer_user_id) : undefined
    return {
      id: o.id,
      order_number: o.order_number,
      placed_at: o.placed_at,
      status: o.status,
      fulfillment_method: o.fulfillment_method,
      total_amount: o.total_amount,
      customerLabel: bc?.display_name_snapshot ?? bc?.email_snapshot ?? 'Customer',
      currency: ctx.business.currency_code,
    }
  })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const pendingCount  = entries.filter((o) => o.status === 'pending').length
  const activeCount   = entries.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const todayCount    = entries.filter((o) => new Date(o.placed_at) >= todayStart).length
  const completedCount = entries.filter((o) => o.status === 'completed').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag size={20} />
            Orders
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage and fulfil customer orders.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`bg-white dark:bg-neutral-900 border rounded-xl px-4 py-3.5 flex items-center gap-3 ${
            pendingCount > 0
              ? 'border-yellow-300 dark:border-yellow-700'
              : 'border-gray-200 dark:border-neutral-800'
          }`}>
            <div className={`p-2 rounded-lg flex-shrink-0 ${
              pendingCount > 0
                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                : 'bg-gray-100 dark:bg-neutral-800'
            }`}>
              <AlertCircle size={15} className={pendingCount > 0 ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-neutral-500'} />
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${pendingCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                {pendingCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0">
              <ShoppingBag size={15} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{activeCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
              <Clock size={15} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{todayCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Today</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <CheckCircle2 size={15} className="text-green-500 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{completedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed</p>
            </div>
          </div>
        </div>
      )}

      {/* Orders list */}
      <OrdersClient orders={entries} slug={slug} />
    </div>
  )
}
