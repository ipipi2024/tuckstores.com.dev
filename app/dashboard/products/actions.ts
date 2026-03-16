'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function resolveCategory(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, categoryName: string | null) {
  if (!categoryName?.trim()) return null

  const name = categoryName.trim()

  // try to find existing category first
  const { data: existing } = await supabase
    .from('product_categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .single()

  if (existing) return existing.id

  // create new category
  const { data: created } = await supabase
    .from('product_categories')
    .insert({ user_id: userId, name })
    .select('id')
    .single()

  return created?.id ?? null
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const sellingPriceRaw = formData.get('selling_price') as string
  const selling_price = sellingPriceRaw ? parseFloat(sellingPriceRaw) : null
  const category_id = await resolveCategory(supabase, user.id, formData.get('category') as string)

  const { error } = await supabase.from('products').insert({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    selling_price: selling_price !== null && !isNaN(selling_price) ? selling_price : null,
    category_id,
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
  const category_id = await resolveCategory(supabase, user.id, formData.get('category') as string)

  const { error } = await supabase.from('products').update({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    selling_price: selling_price !== null && !isNaN(selling_price) ? selling_price : null,
    category_id,
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
