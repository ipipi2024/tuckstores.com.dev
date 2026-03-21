import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ShoppingCart, PackageCheck, Clock, DollarSign, AlertCircle } from 'lucide-react'
import PurchasesClient, { type PurchaseEntry } from './PurchasesClient'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

function fmt(price: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price)
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
      id, purchase_date, total_amount, status, created_at,
      suppliers ( name )
    `)
    .eq('business_id', ctx.business.id)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const all = purchases ?? []
  const currency = ctx.business.currency_code

  const totalCount    = all.length
  const receivedCount = all.filter((p) => p.status === 'received').length
  const orderedCount  = all.filter((p) => p.status === 'ordered').length
  const totalSpend    = all.reduce((sum, p) => sum + (p.total_amount ?? 0), 0)

  const entries: PurchaseEntry[] = all.map((p) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers
    return {
      id: p.id,
      purchase_date: p.purchase_date,
      supplier_name: supplier?.name ?? null,
      total_amount: p.total_amount,
      status: p.status,
      currency,
    }
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={20} />
            Purchases
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track stock purchases from suppliers.
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
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Stat cards */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0">
              <ShoppingCart size={15} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{totalCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <PackageCheck size={15} className="text-green-500 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{receivedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Received</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
              <Clock size={15} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{orderedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ordered</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
              <DollarSign size={15} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums leading-none">{fmt(totalSpend, currency)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total spend</p>
            </div>
          </div>
        </div>
      )}

      {/* Purchases list */}
      <PurchasesClient purchases={entries} slug={slug} canCreate={canCreate} />
    </div>
  )
}
