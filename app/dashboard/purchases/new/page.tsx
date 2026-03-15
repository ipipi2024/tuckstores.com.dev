import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createPurchase } from '../actions'
import NewPurchaseForm from './NewPurchaseForm'

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .order('name')

  const { error } = await searchParams

  return (
    <NewPurchaseForm
      products={products ?? []}
      error={error}
      action={createPurchase}
    />
  )
}
