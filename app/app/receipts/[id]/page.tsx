import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Store, MessageSquare } from 'lucide-react'
import { findOrCreateConversation } from '@/app/app/messages/actions'
import SubmitButton from '@/components/ui/SubmitButton'

type Props = { params: Promise<{ id: string }> }

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtQty(quantity: number, unitSnapshot: string | null): string {
  const unit = unitSnapshot ?? 'unit'
  if (unit === 'unit') return String(Math.round(quantity))
  return `${Number(quantity).toFixed(3)} ${unit}`
}

function fmtDatetime(dateStr: string): string {
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

const PAYMENT_LABEL: Record<string, string> = {
  cash:   'Cash',
  card:   'Card',
  mobile: 'Mobile',
  other:  'Other',
}

export default async function ReceiptDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getAuthUser()
  // Why admin client: businesses join (name/contact info) requires bypassing businesses
  // RLS (members-only). Ownership enforced by .eq('customer_user_id', user.id) below.
  const admin = createAdminClient()

  // Ownership enforced: .eq('customer_user_id', user.id) — returns null if not their receipt
  const { data: sale } = await admin
    .from('sales')
    .select(`
      id, business_id, created_at, sale_channel, status, notes,
      subtotal_amount, discount_amount, tax_amount, total_amount,
      customer_name_snapshot, customer_phone_snapshot,
      businesses ( name, currency_code, phone, email ),
      sale_items (
        id, product_name_snapshot, quantity, unit_snapshot, unit_price, discount_amount, subtotal
      ),
      sale_payments (
        id, payment_method, amount, reference, paid_at
      )
    `)
    .eq('id', id)
    .eq('customer_user_id', user.id)  // ownership enforced here
    .maybeSingle()

  if (!sale) {
    redirect('/app/receipts')
  }

  const biz = Array.isArray(sale.businesses) ? sale.businesses[0] : sale.businesses
  const sale_business_id = sale.business_id
  const currency = biz?.currency_code ?? 'USD'
  const items = sale.sale_items ?? []
  const payments = sale.sale_payments ?? []

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href="/app/receipts"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Receipts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 dark:text-neutral-500">
            {fmtDatetime(sale.created_at)}
          </p>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
            {biz?.name ?? 'Unknown business'}
          </h2>
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${STATUS_STYLE[sale.status] ?? STATUS_STYLE.cancelled}`}>
          {sale.status.replace('_', ' ')}
        </span>
      </div>

      {/* Business info */}
      {(biz?.phone || biz?.email) && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-start gap-3">
          <Store size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            {biz.phone && (
              <p className="text-sm text-gray-700 dark:text-gray-300">{biz.phone}</p>
            )}
            {biz.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{biz.email}</p>
            )}
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Items</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-neutral-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">{item.product_name_snapshot}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {item.unit_snapshot && item.unit_snapshot !== 'unit'
                    ? `${fmtQty(item.quantity, item.unit_snapshot)} @ ${fmtCurrency(item.unit_price, currency)}/${item.unit_snapshot}`
                    : `${Math.round(item.quantity)} × ${fmtCurrency(item.unit_price, currency)}`
                  }
                  {item.discount_amount > 0 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      −{fmtCurrency(item.discount_amount, currency)}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                {fmtCurrency(item.subtotal, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 dark:border-neutral-800 px-4 py-3 space-y-1.5">
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Discount</span>
              <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                −{fmtCurrency(sale.discount_amount, currency)}
              </span>
            </div>
          )}
          {sale.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Tax</span>
              <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                {fmtCurrency(sale.tax_amount, currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100 dark:border-neutral-800">
            <span className="text-gray-900 dark:text-white">Total</span>
            <span className="text-gray-900 dark:text-white tabular-nums">
              {fmtCurrency(sale.total_amount, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payments</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-neutral-800">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {PAYMENT_LABEL[p.payment_method] ?? p.payment_method}
                  </span>
                  {p.reference && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500">{p.reference}</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                  {fmtCurrency(p.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {sale.notes && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sale.notes}</p>
        </div>
      )}

      {/* Contact business */}
      {biz && (
        <form action={findOrCreateConversation.bind(null, sale_business_id)}>
          <SubmitButton
            pendingText="Opening chat…"
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-60"
          >
            <MessageSquare size={15} />
            Contact {biz.name}
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
