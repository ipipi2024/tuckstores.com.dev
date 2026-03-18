import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ShoppingCart, AlertCircle } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
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

export default async function PurchasesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)
  const canCreate = canPerform(ctx.membership.role, 'create_purchase')
  const supabase = await createClient()

  const { data: purchases } = await supabase
    .from('purchases')
    .select(`
      id, purchase_date, total_amount, status, notes, created_at,
      suppliers ( name )
    `)
    .eq('business_id', ctx.business.id)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={20} />
            Purchases
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {purchases?.length ?? 0} record{purchases?.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/business/${slug}/purchases/new`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            New purchase
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!purchases || purchases.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingCart size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No purchases yet.</p>
            {canCreate && (
              <Link
                href={`/business/${slug}/purchases/new`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus size={13} />
                Record first purchase
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Supplier</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {purchases.map((p) => {
                  const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {fmtDate(p.purchase_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {supplier?.name ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                        {fmt(p.total_amount, ctx.business.currency_code)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'received'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : p.status === 'ordered'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/purchases/${p.id}`}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
