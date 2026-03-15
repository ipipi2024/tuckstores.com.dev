'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const sellingPriceRaw = formData.get('selling_price') as string
  const selling_price = sellingPriceRaw ? parseFloat(sellingPriceRaw) : null

  const { error } = await supabase.from('products').insert({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    barcode: formData.get('barcode') as string || null,
    selling_price: selling_price !== null && !isNaN(selling_price) ? selling_price : null,
    user_id: user.id,
  })

  if (error) redirect(`/dashboard/products/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/products')
  redirect('/dashboard/products')
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const sellingPriceRaw = formData.get('selling_price') as string
  const selling_price = sellingPriceRaw ? parseFloat(sellingPriceRaw) : null

  const { error } = await supabase.from('products').update({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    barcode: formData.get('barcode') as string || null,
    selling_price: selling_price !== null && !isNaN(selling_price) ? selling_price : null,
  }).eq('id', id).eq('user_id', user.id)

  if (error) redirect(`/dashboard/products/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/products')
  redirect('/dashboard/products')
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  await supabase.from('products').delete().eq('id', id)
  revalidatePath('/dashboard/products')
}
