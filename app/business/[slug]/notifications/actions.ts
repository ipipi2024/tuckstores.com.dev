'use server'

import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Mark all notifications as read for a vendor (business member).
 * Does NOT touch orders.customer_seen_status — vendors have no order-seen state.
 */
export async function markAllVendorNotificationsSeen(slug: string): Promise<void> {
  const user = await getAuthUser()
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath(`/business/${slug}`, 'layout')
}
