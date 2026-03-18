import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_STYLE: Record<string, string> = {
  completed:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:          'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
  refunded:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partially_refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export default async function ReceiptsPage() {
  const user = await getAuthUser()
  // Why admin client: businesses join requires bypassing businesses RLS (members-only).
  // Ownership enforced by .eq('customer_user_id', user.id).
  const admin = createAdminClient()

  const { data: sales } = await admin
    .from('sales')
    .select(`
      id, created_at, total_amount, status,
      businesses ( name, currency_code )
    `)
    .eq('customer_user_id', user.id)
    .order('created_at', { ascending: false })

  const allSales = sales ?? []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt size={18} />
          Receipts
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {allSales.length} receipt{allSales.length !== 1 ? 's' : ''}
        </p>
      </div>

      {allSales.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-10 text-center">
          <Receipt size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No receipts yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
            When a business links your account to a sale, the receipt will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {allSales.map((sale) => {
            const biz = Array.isArray(sale.businesses) ? sale.businesses[0] : sale.businesses
            return (
              <Link
                key={sale.id}
                href={`/app/receipts/${sale.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {/* Business initial */}
                <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {(biz?.name ?? '?').charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {biz?.name ?? 'Unknown business'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                    {fmtDate(sale.created_at)}
                  </p>
                </div>

                {/* Amount + status */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {sale.total_amount != null
                      ? fmtCurrency(sale.total_amount, biz?.currency_code ?? 'USD')
                      : '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[sale.status] ?? STATUS_STYLE.cancelled}`}>
                    {sale.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
