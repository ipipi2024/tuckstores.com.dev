import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { adjustInventory } from '../actions'
import AdjustForm from './AdjustForm'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function AdjustInventoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'adjust_inventory')) {
    redirect(`/business/${slug}/inventory`)
  }

  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, measurement_type, base_unit')
    .eq('business_id', ctx.business.id)
    .eq('is_active', true)
    .order('name')

  const action = adjustInventory.bind(null, slug)

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={20} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Adjust Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Manually add or remove stock. All changes are recorded in the inventory ledger.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <AdjustForm products={products ?? []} action={action} error={error} />
      </div>
    </div>
  )
}
