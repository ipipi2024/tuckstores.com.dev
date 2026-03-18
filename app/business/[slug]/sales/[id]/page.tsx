import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'


type Props = {
  params: Promise<{ slug: string; id: string }>
}

function fmt(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
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

export default async function SaleDetailPage({ params }: Props) {
  const { slug, id } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_sales')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()

  const { data: sale } = await supabase
    .from('sales')
    .select(`
      id, created_at, sale_channel, status, notes,
      subtotal_amount, discount_amount, tax_amount, total_amount,
      customer_user_id, customer_name_snapshot, customer_phone_snapshot,
      recorded_by:recorded_by_user_id ( full_name ),
      sale_items (
        id, product_name_snapshot, quantity, unit_price, discount_amount, subtotal
      ),
      sale_payments (
        id, payment_method, amount, reference, paid_at
      )
    `)
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!sale) {
    redirect(`/business/${slug}/sales?error=Sale+not+found`)
  }

  const recorder = Array.isArray(sale.recorded_by) ? sale.recorded_by[0] : sale.recorded_by
  const items    = sale.sale_items ?? []
  const payments = sale.sale_payments ?? []

  // For online orders, customer_name_snapshot is null — look up from business_customers
  let bcCustomer: { display_name_snapshot: string | null; email_snapshot: string | null; phone_snapshot: string | null } | null = null
  if (sale.customer_user_id && !sale.customer_name_snapshot) {
    const { data: bc } = await supabase
      .from('business_customers')
      .select('display_name_snapshot, email_snapshot, phone_snapshot')
      .eq('business_id', ctx.business.id)
      .eq('user_id', sale.customer_user_id)
      .maybeSingle()
    bcCustomer = bc ?? null
  }

  const customerName  = sale.customer_name_snapshot  ?? bcCustomer?.display_name_snapshot ?? bcCustomer?.email_snapshot ?? null
  const customerPhone = sale.customer_phone_snapshot ?? bcCustomer?.phone_snapshot ?? null

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back + title */}
      <div>
        <Link
          href={`/business/${slug}/sales`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={14} />
          Back to Sales
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Sale — {fmtDatetime(sale.created_at)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {CHANNEL_LABEL[sale.sale_channel] ?? sale.sale_channel}
              {recorder?.full_name && (
                <> · recorded by {recorder.full_name}</>
              )}
            </p>
          </div>
          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${STATUS_STYLE[sale.status] ?? STATUS_STYLE.cancelled}`}>
            {sale.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <User size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer</h2>
        </div>
        {customerName || customerPhone || sale.customer_user_id ? (
          <div className="space-y-1">
            <p className="text-sm text-gray-900 dark:text-white font-medium">
              {customerName ?? 'Platform customer'}
            </p>
            {customerPhone && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{customerPhone}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-neutral-500">Guest — no customer recorded</p>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 dark:border-neutral-800 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">Product</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-right">Qty</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-right">Unit price</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-right hidden sm:table-cell">Discount</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{item.product_name_snapshot}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmt(item.unit_price, ctx.business.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums hidden sm:table-cell">
                    {item.discount_amount > 0
                      ? `−${fmt(item.discount_amount, ctx.business.currency_code)}`
                      : <span className="text-gray-300 dark:text-neutral-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmt(item.subtotal, ctx.business.currency_code)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-100 dark:border-neutral-800">
              {sale.discount_amount > 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">Discount</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                    −{fmt(sale.discount_amount, ctx.business.currency_code)}
                  </td>
                </tr>
              )}
              {sale.tax_amount > 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">Tax</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmt(sale.tax_amount, ctx.business.currency_code)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                  {fmt(sale.total_amount, ctx.business.currency_code)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Payments</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-neutral-800">
            {payments.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{p.payment_method}</span>
                  {p.reference && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500">{p.reference}</span>
                  )}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums font-medium">
                  {fmt(p.amount, ctx.business.currency_code)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {sale.notes && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sale.notes}</p>
        </div>
      )}
    </div>
  )
}
