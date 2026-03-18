'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/get-user'

export async function updateProfile(formData: FormData) {
  const user = await getAuthUser()

  const fullName = (formData.get('full_name') as string | null)?.trim() || null
  const phone    = (formData.get('phone') as string | null)?.trim() || null

  // Regular client is fine — RLS allows users to update their own row
  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ full_name: fullName, phone })
    .eq('id', user.id)

  if (error) {
    redirect(`/app/profile?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/app/profile')
  revalidatePath('/app')
  redirect('/app/profile?success=1')
}
