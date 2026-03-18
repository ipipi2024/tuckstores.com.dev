'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSubscription } from '@/lib/require-subscription'

export async function addCustomer(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await requireSubscription(supabase, user)

  const { error } = await supabase.from('customers').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    phone: formData.get('phone') as string || null,
    email: formData.get('email') as string || null,
    notes: formData.get('notes') as string || null,
  })

  if (error) redirect(`/dashboard/customers/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await requireSubscription(supabase, user)
  await supabase.from('customers').delete().eq('id', id)
  revalidatePath('/dashboard/customers')
}
