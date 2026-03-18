'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSubscription } from '@/lib/require-subscription'

export async function addSupplier(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await requireSubscription(supabase, user)

  const { error } = await supabase.from('suppliers').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    phone: formData.get('phone') as string || null,
    email: formData.get('email') as string || null,
    notes: formData.get('notes') as string || null,
  })

  if (error) redirect(`/dashboard/suppliers/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/suppliers')
  redirect('/dashboard/suppliers')
}

// Quick-add a supplier from the purchase form and redirect back with the new supplier pre-selected
export async function createQuickSupplier(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await requireSubscription(supabase, user)

  const name = (formData.get('name') as string).trim()
  if (!name) redirect('/dashboard/purchases/new?error=Supplier+name+is+required')

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ user_id: user.id, name })
    .select('id')
    .single()

  if (error) redirect(`/dashboard/purchases/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/suppliers')
  redirect(`/dashboard/purchases/new?supplier_id=${data.id}`)
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await requireSubscription(supabase, user)
  await supabase.from('suppliers').delete().eq('id', id)
  revalidatePath('/dashboard/suppliers')
}
