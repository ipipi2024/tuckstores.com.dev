import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  User,
  MapPin,
  MessageSquare,
  XCircle,
} from 'lucide-react'
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

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending',
  accepted:         'Accepted',
  rejected:         'Rejected',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'Out for delivery',
  completed:        'Completed',
  cancelled:        'Cancelled',
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

const SHOW_NOTE = new Set(['rejected', 'cancelled'])

const STEP_LABEL: Record<string, string> = {
  pending:          'Pending',
  accepted:         'Accepted',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'En route',
  completed:        'Done',
}

function StatusStepper({ status, fulfillmentMethod }: { status: string; fulfillmentMethod: string }) {
  if (status === 'rejected' || status === 'cancelled') return null

  const steps =
    fulfillmentMethod === 'delivery'
      ? ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed']
      : ['pending', 'accepted', 'preparing', 'ready', 'completed']

  const currentIndex = steps.indexOf(status)

  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const done    = i < currentIndex
        const current = i === currentIndex
        const last    = i === steps.length - 1

        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                current
                  ? 'bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.2)] dark:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]'
                  : done
                  ? 'bg-indigo-400 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-neutral-700'
              }`} />
              <span className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                current
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : done
                  ? 'text-gray-400 dark:text-neutral-500'
                  : 'text-gray-300 dark:text-neutral-600'
              }`}>
                {STEP_LABEL[step] ?? step}
              </span>
            </div>
            {!last && (
              <div className={`h-px flex-1 mx-1 mb-[18px] transition-colors ${
                done ? 'bg-indigo-400 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-neutral-700'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function BusinessOrderDetailPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { success, error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_orders')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const canManage = canPerform(ctx.membership.role, 'manage_orders')
  const supabase  = await createClient()
  const admin     = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, placed_at, status, fulfillment_method,
      subtotal_amount, delivery_fee, total_amount,
      customer_note, delivery_address, business_note, customer_user_id,
      order_items ( id, product_name_snapshot, unit_price_snapshot, quantity, line_total )
    `)
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .single()

  if (!order) notFound()

  let customer: {
    display_name_snapshot: string | null
    email_snapshot: string | null
    phone_snapshot: string | null
  } | null = null

  if (order.customer_user_id) {
    const { data: bc } = await admin
      .from('business_customers')
      .select('display_name_snapshot, email_snapshot, phone_snapshot')
      .eq('business_id', ctx.business.id)
      .eq('user_id', order.customer_user_id)
      .maybeSingle()
    customer = bc ?? null
  }

  const items      = order.order_items ?? []
  const currency   = ctx.business.currency_code
  const isDelivery = order.fulfillment_method === 'delivery'
  const isTerminal = ['rejected', 'cancelled', 'completed'].includes(order.status)

  const nextStatuses = canManage
    ? (TRANSITIONS[order.status] ?? []).filter(
        (s) => s !== 'out_for_delivery' || isDelivery
      )
    : []

  const action = updateOrderStatus.bind(null, slug, order.id)

  const hasNotes = order.customer_note || order.delivery_address || order.business_note

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div>
        <Link
          href={`/business/${slug}/orders`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Orders
        </Link>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.order_number}</h1>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{fmtDate(order.placed_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium ${
              isDelivery
                ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}>
              {isDelivery ? <Truck size={11} /> : <Package size={11} />}
              {isDelivery ? 'Delivery' : 'Pickup'}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback banners */}
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

      {/* Status progress stepper */}
      {!isTerminal && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 pt-5 pb-4">
          <StatusStepper status={order.status} fulfillmentMethod={order.fulfillment_method} />
        </div>
      )}

      {/* Terminal state callout */}
      {(order.status === 'rejected' || order.status === 'cancelled') && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <XCircle size={16} className="flex-shrink-0" />
          This order was {order.status}.
        </div>
      )}

      {/* Status actions — FIRST, so operators see them immediately */}
      {nextStatuses.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
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

      {/* Customer */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <User size={14} className="text-gray-400 dark:text-neutral-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Customer</span>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {customer?.display_name_snapshot ?? customer?.email_snapshot ?? 'Customer'}
        </p>
        {customer?.email_snapshot && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{customer.email_snapshot}</p>
        )}
        {customer?.phone_snapshot && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{customer.phone_snapshot}</p>
        )}
      </div>

      {/* Order items + totals */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60 dark:bg-neutral-800/40 border-b border-gray-100 dark:border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Items · {items.length}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Total
          </span>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-neutral-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-gray-800 dark:text-gray-200 font-medium">{item.product_name_snapshot}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {fmtCurrency(item.unit_price_snapshot, currency)} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums ml-4 flex-shrink-0">
                {fmtCurrency(item.line_total, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800 space-y-1.5">
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
          <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white pt-1.5 border-t border-gray-100 dark:border-neutral-800">
            <span>Total</span>
            <span className="tabular-nums">{fmtCurrency(order.total_amount, currency)}</span>
          </div>
        </div>
      </div>

      {/* Delivery address, customer note, business note — consolidated */}
      {hasNotes && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {order.delivery_address && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin size={12} className="text-gray-400 dark:text-neutral-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Delivery address</p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_address}</p>
            </div>
          )}
          {order.customer_note && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={12} className="text-gray-400 dark:text-neutral-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Customer note</p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer_note}</p>
            </div>
          )}
          {order.business_note && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={12} className="text-indigo-400 dark:text-indigo-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Your note to customer</p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{order.business_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
