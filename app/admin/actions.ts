'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function grantCredit(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const userId = formData.get('user_id') as string

  // Extend from current expiry if still active, otherwise from now
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .single()

  const base =
    existing && new Date(existing.expires_at) > new Date()
      ? new Date(existing.expires_at)
      : new Date()

  const newExpiry = new Date(base)
  newExpiry.setDate(newExpiry.getDate() + 30)

  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      expires_at: newExpiry.toISOString(),
      granted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  revalidatePath('/admin')
}
