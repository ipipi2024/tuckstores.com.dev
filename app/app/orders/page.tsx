import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ShoppingBag, ChevronRight, Clock, Store } from 'lucide-react'

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
    year: 'numeric',
  })
}

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'])

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

export default async function OrdersPage() {
  const user = await getAuthUser()
  const admin = createAdminClient()

  const { data: orders } = await admin
    .from('orders')
    .select('id, order_number, placed_at, total_amount, status, fulfillment_method, businesses ( name, currency_code )')
    .eq('customer_user_id', user.id)
    .order('placed_at', { ascending: false })
    .limit(100)

  const allOrders = orders ?? []
  const activeOrders = allOrders.filter((o) => ACTIVE_STATUSES.has(o.status))
  const pastOrders   = allOrders.filter((o) => !ACTIVE_STATUSES.has(o.status))

  if (allOrders.length === 0) {
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My orders</h2>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-14 text-center space-y-3">
          <ShoppingBag size={36} className="mx-auto text-gray-300 dark:text-neutral-600" />
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No orders yet</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Place an order from any store and it'll show up here.
            </p>
          </div>
          <Link
            href="/businesses"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <Store size={14} />
            Browse stores
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My orders</h2>

      {/* ── Active orders ────────────────────────────────── */}
      {activeOrders.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-indigo-500" />
            <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
              Active · {activeOrders.length}
            </h3>
          </div>
          <div className="space-y-2">
            {activeOrders.map((order) => {
              const biz = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses
              return (
                <Link
                  key={order.id}
                  href={`/app/orders/${order.id}`}
                  className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-4 py-3.5 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {biz?.name ?? 'Unknown store'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {order.order_number} · {fmtDate(order.placed_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
                      {STATUS_LABEL[order.status] ?? order.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtCurrency(order.total_amount, biz?.currency_code ?? 'USD')}
                    </span>
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Track order →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Past orders ──────────────────────────────────── */}
      {pastOrders.length > 0 && (
        <section className="space-y-2">
          {activeOrders.length > 0 && (
            <h3 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
              Past
            </h3>
          )}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {pastOrders.map((order) => {
              const biz = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses
              return (
                <Link
                  key={order.id}
                  href={`/app/orders/${order.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {biz?.name ?? 'Unknown store'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {order.order_number} · {fmtDate(order.placed_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtCurrency(order.total_amount, biz?.currency_code ?? 'USD')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>
                      {STATUS_LABEL[order.status] ?? order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ChevronRight size={15} className="text-gray-300 dark:text-neutral-600 shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
