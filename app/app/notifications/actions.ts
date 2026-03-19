'use server'

import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Mark a single notification as read.
 * Returns the new authoritative unread count so the client can sync context
 * without another round-trip.
 */
export async function markNotificationRead(id: string): Promise<number> {
  const user = await getAuthUser()
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null)

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  // Invalidate the full app layout so initialUnreadCount is fresh on next render
  revalidatePath('/app', 'layout')
  return count ?? 0
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const user = await getAuthUser()
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath('/app', 'layout')
}
