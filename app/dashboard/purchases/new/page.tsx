import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createPurchase } from '../actions'
import NewPurchaseForm from './NewPurchaseForm'

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; supplier_id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').order('name'),
  ])

  const { error, supplier_id } = await searchParams

  return (
    <NewPurchaseForm
      products={products ?? []}
      suppliers={suppliers ?? []}
      defaultSupplierId={supplier_id ?? ''}
      error={error}
      action={createPurchase}
    />
  )
}
