import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function requireSubscription(
  supabase: SupabaseClient,
  user: { id: string; email?: string },
) {
  if (user.email === process.env.ADMIN_EMAIL) return

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', user.id)
    .single()

  if (!sub || new Date(sub.expires_at) < new Date()) {
    redirect('/subscribe')
  }
}
