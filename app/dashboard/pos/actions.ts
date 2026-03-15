'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SaleItem = {
  product_id: string
  quantity: number
  unit_price: number
}

export async function completeSale(
  items: SaleItem[],
  notes?: string | null,
): Promise<{ error: string } | { saleId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!items.length) return { error: 'Cart is empty' }

  const { data: saleId, error } = await supabase.rpc('create_sale', {
    p_notes: notes ?? null,
    p_items: items,
    p_customer_id: null,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/sales')
  revalidatePath('/dashboard/inventory')
  return { saleId: saleId as string }
}

export async function linkSaleToCustomer(
  saleId: string,
  customerId: string,
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('sales')
    .update({ customer_id: customerId })
    .eq('id', saleId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/sales')
  return null
}

export async function registerWalkInCustomer(
  name: string,
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('customers').insert({
    user_id: user.id,
    name: name.trim(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/customers')
  return null
}
