import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ShoppingBag, CheckCircle2, AlertCircle,
  Package, Truck, Receipt, Store
} from 'lucide-react'
import CancelOrderButton from './CancelOrderButton'
import CartClearer from './CartClearer'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ placed?: string; cancelled?: string; error?: string }>
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

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending confirmation',
  accepted:         'Accepted',
  rejected:         'Rejected',
  preparing:        'Being prepared',
  ready:            'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed:        'Completed',
  cancelled:        'Cancelled',
}

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { placed, cancelled, error } = await searchParams
  const user = await getAuthUser()
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select(`
      id, order_number, placed_at, status, fulfillment_method,
      subtotal_amount, delivery_fee, total_amount,
      customer_note, delivery_address, business_note,
      businesses ( id, name, slug, currency_code ),
      order_items ( id, product_name_snapshot, unit_price_snapshot, quantity, line_total )
    `)
    .eq('id', id)
    .eq('customer_user_id', user.id)
    .single()

  if (!order) notFound()

  const biz = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses

  // Look up the sale generated when this order was completed (matched by notes field)
  let receiptId: string | null = null
  if (order.status === 'completed') {
    const { data: sale } = await admin
      .from('sales')
      .select('id')
      .eq('customer_user_id', user.id)
      .eq('notes', `Order ${order.order_number}`)
      .maybeSingle()
    receiptId = sale?.id ?? null
  }
  const items = order.order_items ?? []
  const currency = biz?.currency_code ?? 'USD'

  return (
    <div className="space-y-5">
      {/* Clear cart on successful placement */}
      {placed === '1' && <CartClearer />}

      <div className="flex items-center gap-3">
        <Link
          href="/app/orders"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{order.order_number}</h2>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{fmtDate(order.placed_at)}</p>
        </div>
      </div>

      {placed === '1' && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          Order placed! The business will confirm shortly.
        </div>
      )}

      {cancelled === '1' && (
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          Order cancelled.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Status */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {order.fulfillment_method === 'delivery' ? (
            <Truck size={18} className="text-gray-400" />
          ) : (
            <Package size={18} className="text-gray-400" />
          )}
          <div>
            <p className="text-xs text-gray-400 dark:text-neutral-500 capitalize">
              {order.fulfillment_method}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {STATUS_LABEL[order.status] ?? order.status}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Business */}
      {biz && (
        <Link
          href={`/businesses/${biz.slug}`}
          className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Store size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{biz.name}</span>
        </Link>
      )}

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <ShoppingBag size={14} className="text-gray-400" />
            Items
          </h3>
        </div>
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
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Your note</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer_note}</p>
        </div>
      )}

      {/* Business note */}
      {order.business_note && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Note from business</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.business_note}</p>
        </div>
      )}

      {(order.status === 'pending' || order.status === 'accepted') && (
        <CancelOrderButton orderId={order.id} />
      )}

      {/* Receipt link (only when completed and sale was created) */}
      {receiptId && (
        <Link
          href={`/app/receipts/${receiptId}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Receipt size={15} />
          View receipt
        </Link>
      )}
    </div>
  )
}
