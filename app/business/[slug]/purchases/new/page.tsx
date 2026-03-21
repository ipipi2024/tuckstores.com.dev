import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createPurchase } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import NewPurchaseForm from './NewPurchaseForm'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function NewPurchasePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'create_purchase')) {
    redirect(`/business/${slug}/purchases`)
  }

  const supabase = await createClient()

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, cost_price_default, measurement_type, base_unit')
      .eq('business_id', ctx.business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('business_id', ctx.business.id)
      .order('name'),
  ])

  const action = createPurchase.bind(null, slug)

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">New Purchase</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <NewPurchaseForm
        action={action}
        products={products ?? []}
        suppliers={suppliers ?? []}
        currencyCode={ctx.business.currency_code}
        slug={slug}
      />
    </div>
  )
}
