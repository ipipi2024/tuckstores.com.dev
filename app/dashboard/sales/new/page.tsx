import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSale } from '../actions'
import NewSaleForm from './NewSaleForm'

export default async function NewSalePage({
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
    <NewSaleForm
      products={products ?? []}
      error={error}
      action={createSale}
    />
  )
}
