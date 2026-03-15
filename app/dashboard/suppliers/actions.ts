'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addSupplier(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

export async function deleteSupplier(id: string) {
  const supabase = await createClient()
  await supabase.from('suppliers').delete().eq('id', id)
  revalidatePath('/dashboard/suppliers')
}
