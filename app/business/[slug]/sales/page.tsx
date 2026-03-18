import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Receipt, AlertCircle } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
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

export default async function SalesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_sales')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()

  const { data: sales } = await supabase
    .from('sales')
    .select(`
      id, created_at, total_amount, sale_channel, status,
      customer_name_snapshot, customer_user_id,
      recorded_by:recorded_by_user_id ( full_name )
    `)
    .eq('business_id', ctx.business.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt size={20} />
            Sales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {sales?.length ?? 0} record{sales?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!sales || sales.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Receipt size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No sales yet.</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Sales are recorded through the POS.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Channel</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Recorded by</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {sales.map((s) => {
                  const recorder = Array.isArray(s.recorded_by) ? s.recorded_by[0] : s.recorded_by
                  const customerLabel = s.customer_name_snapshot
                    ?? (s.customer_user_id ? 'Linked customer' : null)

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                        {fmtDatetime(s.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {customerLabel ?? (
                          <span className="text-gray-300 dark:text-neutral-600">Guest</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {CHANNEL_LABEL[s.sale_channel] ?? s.sale_channel}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {recorder?.full_name ?? (
                          <span className="text-gray-300 dark:text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums font-medium">
                        {fmt(s.total_amount, ctx.business.currency_code)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? STATUS_STYLE.cancelled}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/sales/${s.id}`}
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
