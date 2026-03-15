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
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!items.length) return { error: 'Cart is empty' }

  const { error } = await supabase.rpc('create_sale', {
    p_notes: notes ?? null,
    p_items: items,
    p_customer_id: null,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/sales')
  revalidatePath('/dashboard/inventory')
  return null
}
