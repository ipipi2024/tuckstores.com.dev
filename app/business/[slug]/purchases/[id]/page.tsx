import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MessageSquare } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string; id: string }>
}

function fmt(price: number | null, currency: string): string {
  if (price === null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price)
}

function fmtQty(quantity: number, unitSnapshot: string | null): string {
  const unit = unitSnapshot ?? 'unit'
  if (unit === 'unit') return String(Math.round(quantity))
  return `${Number(quantity).toFixed(3)} ${unit}`
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  ordered:  'Ordered',
  draft:    'Draft',
}

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ordered:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  draft:    'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
}

export default async function PurchaseDetailPage({ params }: Props) {
  const { slug, id } = await params
  const ctx = await getBusinessContext(slug)
  const supabase = await createClient()
  const currency = ctx.business.currency_code

  const { data: purchase } = await supabase
    .from('purchases')
    .select(`
      id, purchase_date, total_amount, status, notes, created_at,
      suppliers ( name ),
      purchase_items (
        id, product_name_snapshot, quantity, unit_snapshot, unit_cost, subtotal
      )
    `)
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!purchase) {
    redirect(`/business/${slug}/purchases?error=Purchase+not+found`)
  }

  const supplier = Array.isArray(purchase.suppliers) ? purchase.suppliers[0] : purchase.suppliers
  const items = purchase.purchase_items ?? []

  return (
    <div className="max-w-lg space-y-4">
      {/* Back link */}
      <Link
        href={`/business/${slug}/purchases`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Purchases
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {fmtDate(purchase.purchase_date)}
          </h1>
          {supplier?.name && (
            <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <Building2 size={13} className="text-gray-400 dark:text-neutral-500" />
              {supplier.name}
            </p>
          )}
        </div>
        <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium mt-1 flex-shrink-0 ${STATUS_STYLE[purchase.status] ?? STATUS_STYLE.draft}`}>
          {STATUS_LABEL[purchase.status] ?? purchase.status}
        </span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60 dark:bg-neutral-800/40 border-b border-gray-100 dark:border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Items · {items.length}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Subtotal
          </span>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-neutral-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-gray-800 dark:text-gray-200 font-medium">{item.product_name_snapshot}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {fmt(item.unit_cost, currency)} × {fmtQty(item.quantity, item.unit_snapshot)}
                </p>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums ml-4 flex-shrink-0">
                {fmt(item.subtotal, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800">
          <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white">
            <span>Total</span>
            <span className="tabular-nums">{fmt(purchase.total_amount, currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {purchase.notes && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={12} className="text-gray-400 dark:text-neutral-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Notes</p>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{purchase.notes}</p>
        </div>
      )}
    </div>
  )
}
