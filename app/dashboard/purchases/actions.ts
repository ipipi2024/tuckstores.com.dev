'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createPurchase(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supplier_name = formData.get('supplier_name') as string
  const purchase_date = formData.get('purchase_date') as string
  const notes = formData.get('notes') as string

  // collect items from form  (product_id_0, quantity_0, unit_cost_0 ...)
  const items: { product_id: string; quantity: number; unit_cost: number }[] = []
  let i = 0
  while (formData.get(`product_id_${i}`)) {
    items.push({
      product_id: formData.get(`product_id_${i}`) as string,
      quantity: Number(formData.get(`quantity_${i}`)),
      unit_cost: Number(formData.get(`unit_cost_${i}`)),
    })
    i++
  }

  if (items.length === 0) {
    redirect('/dashboard/purchases/new?error=Add+at+least+one+item')
  }

  const { error } = await supabase.rpc('create_purchase', {
    p_supplier_name: supplier_name || null,
    p_purchase_date: purchase_date,
    p_notes: notes || null,
    p_items: items,
  })

  if (error) redirect(`/dashboard/purchases/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/purchases')
  revalidatePath('/dashboard/products')
  redirect('/dashboard/purchases')
}
