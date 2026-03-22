'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitVendorApplication(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name  = (formData.get('name') as string | null)?.trim()
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!name || name.length < 2) {
    redirect('/vendor/apply?error=Please+enter+your+name')
  }

  const { error } = await supabase.from('vendor_applications').insert({
    user_id: user.id,
    email:   user.email!,
    name,
    notes,
  })

  if (error) {
    // Unique constraint violation means they already have an application
    if (error.code === '23505') {
      redirect('/vendor/apply?error=You+already+have+a+pending+application')
    }
    redirect(`/vendor/apply?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/vendor/apply?submitted=1')
}
