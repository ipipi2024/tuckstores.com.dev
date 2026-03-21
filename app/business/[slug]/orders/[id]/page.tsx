import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertCircle, Package, Truck, User } from 'lucide-react'
import { updateOrderStatus } from '../actions'
import StatusAction from './StatusAction'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

const TRANSITIONS: Record<string, string[]> = {
  pending:          ['accepted', 'rejected'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['ready'],
  ready:            ['out_for_delivery', 'completed'],
  out_for_delivery: ['completed'],
  rejected:         [],
  completed:        [],
  cancelled:        [],
}

// Statuses where a business note is useful
const SHOW_NOTE = new Set(['rejected', 'cancelled'])

export default async function BusinessOrderDetailPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { success, error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_orders')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const canManage = canPerform(ctx.membership.role, 'manage_orders')

  const supabase = await createClient()
  const admin    = createAdminClient()

  const [{ data: order }, ] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, order_number, placed_at, status, fulfillment_method,
        subtotal_amount, delivery_fee, total_amount,
        customer_note, delivery_address, business_note, customer_user_id,
        order_items ( id, product_name_snapshot, unit_price_snapshot, quantity, line_total )
      `)
      .eq('id', id)
      .eq('business_id', ctx.business.id)
      .single(),
  ])

  if (!order) notFound()

  // Fetch customer from business_customers (least-privilege read model)
  let customer: { display_name_snapshot: string | null; email_snapshot: string | null; phone_snapshot: string | null } | null = null
  if (order.customer_user_id) {
    const { data: bc } = await admin
      .from('business_customers')
      .select('display_name_snapshot, email_snapshot, phone_snapshot')
      .eq('business_id', ctx.business.id)
      .eq('user_id', order.customer_user_id)
      .maybeSingle()
    customer = bc ?? null
  }

  const items = order.order_items ?? []
  const currency = ctx.business.currency_code
  const nextStatuses = canManage
    ? (TRANSITIONS[order.status] ?? []).filter(
        s => s !== 'out_for_delivery' || order.fulfillment_method === 'delivery'
      )
    : []

  const action = updateOrderStatus.bind(null, slug, order.id)

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/business/${slug}/orders`}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.order_number}</h1>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{fmtDate(order.placed_at)}</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          Order status updated.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Status + fulfillment */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {order.fulfillment_method === 'delivery'
            ? <Truck size={18} className="text-gray-400" />
            : <Package size={18} className="text-gray-400" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
            {order.fulfillment_method}
          </span>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Customer */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Customer</span>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {customer?.display_name_snapshot ?? customer?.email_snapshot ?? 'Customer'}
        </p>
        {customer?.email_snapshot && (
          <p className="text-xs text-gray-400 dark:text-neutral-500">{customer.email_snapshot}</p>
        )}
        {customer?.phone_snapshot && (
          <p className="text-xs text-gray-400 dark:text-neutral-500">{customer.phone_snapshot}</p>
        )}
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                {item.product_name_snapshot}
                <span className="text-gray-400 dark:text-neutral-500 ml-1">× {item.quantity}</span>
              </span>
              <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                {fmtCurrency(item.line_total, currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800 space-y-1">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmtCurrency(order.subtotal_amount, currency)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Delivery fee</span>
              <span className="tabular-nums">{fmtCurrency(order.delivery_fee, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-neutral-800">
            <span>Total</span>
            <span className="tabular-nums">{fmtCurrency(order.total_amount, currency)}</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      {order.delivery_address && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Delivery address</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_address}</p>
        </div>
      )}

      {/* Customer note */}
      {order.customer_note && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Customer note</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer_note}</p>
        </div>
      )}

      {/* Business note */}
      {order.business_note && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Your note to customer</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.business_note}</p>
        </div>
      )}

      {/* Status actions */}
      {nextStatuses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
            Update status
          </p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <StatusAction
                key={s}
                action={action}
                status={s}
                showNoteField={SHOW_NOTE.has(s)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
