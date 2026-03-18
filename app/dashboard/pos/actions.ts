'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSubscription } from '@/lib/require-subscription'

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
  await requireSubscription(supabase, user)

  if (!items.length) return { error: 'Cart is empty' }

  // Validate stock before committing
  const { data: stockData } = await supabase
    .from('products')
    .select('id, name, stock')
    .in('id', items.map((i) => i.product_id))
    .eq('user_id', user.id)

  if (stockData) {
    for (const item of items) {
      const product = stockData.find((p) => p.id === item.product_id)
      if (product) {
        if (product.stock === null || product.stock === 0) {
          return {
            error: `"${product.name}" has no inventory — record a purchase before selling`,
          }
        }
        if (product.stock < item.quantity) {
          return {
            error: `"${product.name}" only has ${product.stock} in stock — update inventory before selling`,
          }
        }
      }
    }
  }

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
  await requireSubscription(supabase, user)

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
  await requireSubscription(supabase, user)

  const { error } = await supabase.from('customers').insert({
    user_id: user.id,
    name: name.trim(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/customers')
  return null
}
