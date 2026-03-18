import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function PurchaseDetailPage({ params }: Props) {
  const { slug, id } = await params
  const ctx = await getBusinessContext(slug)
  const supabase = await createClient()

  const { data: purchase } = await supabase
    .from('purchases')
    .select(`
      id, purchase_date, total_amount, status, notes, created_at,
      suppliers ( name ),
      purchase_items (
        id, product_name, quantity, unit_cost, subtotal
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
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/business/${slug}/purchases`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={14} />
          Back to Purchases
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Purchase — {fmtDate(purchase.purchase_date)}
            </h1>
            {supplier?.name && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{supplier.name}</p>
            )}
          </div>
          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${
            purchase.status === 'received'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : purchase.status === 'ordered'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
          }`}>
            {purchase.status}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Product</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Unit cost</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{item.product_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmt(item.unit_cost, ctx.business.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmt(item.subtotal, ctx.business.currency_code)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-neutral-800">
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                  {fmt(purchase.total_amount, ctx.business.currency_code)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {purchase.notes && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{purchase.notes}</p>
        </div>
      )}
    </div>
  )
}
