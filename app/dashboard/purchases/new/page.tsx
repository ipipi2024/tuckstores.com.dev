import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitPurchase, quickAddSupplier } from '../actions'
import NewPurchaseForm from './NewPurchaseForm'

export default async function NewPurchasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('id, name, stock').order('name'),
    supabase.from('suppliers').select('id, name').order('name'),
  ])

  return (
    <NewPurchaseForm
      products={products ?? []}
      suppliers={suppliers ?? []}
      onSubmit={submitPurchase}
      onQuickAddSupplier={quickAddSupplier}
    />
  )
}
