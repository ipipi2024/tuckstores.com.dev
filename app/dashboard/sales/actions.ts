'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createSale(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const notes = formData.get('notes') as string

  const items: { product_id: string; quantity: number; unit_price: number }[] = []
  let i = 0
  while (formData.get(`product_id_${i}`)) {
    items.push({
      product_id: formData.get(`product_id_${i}`) as string,
      quantity: Number(formData.get(`quantity_${i}`)),
      unit_price: Number(formData.get(`unit_price_${i}`)),
    })
    i++
  }

  if (items.length === 0) {
    redirect('/dashboard/sales/new?error=Add+at+least+one+item')
  }

  const { error } = await supabase.rpc('create_sale', {
    p_notes: notes || null,
    p_items: items,
  })

  if (error) redirect(`/dashboard/sales/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/sales')
  revalidatePath('/dashboard/inventory')
  redirect('/dashboard/sales')
}
