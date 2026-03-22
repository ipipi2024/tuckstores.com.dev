'use server'

import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30

/**
 * Mark a single notification as read.
 * Returns the new authoritative unread count so the client can sync context
 * without another round-trip.
 *
 * Note: revalidatePath is intentionally omitted here. The bell badge is kept
 * correct by the returned count via setUnreadCount(). revalidatePath on every
 * individual click added a needless background layout re-render.
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

  return count ?? 0
}

/**
 * Mark all unread notifications as read for the current user.
 * revalidatePath is kept here — this is a bulk action where refreshing
 * the layout's initialUnreadCount is worth the cost.
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

/**
 * Mark a single order as seen by the current customer.
 * Called when they open an order-related notification so only that order's
 * badge contribution is cleared (not all orders).
 */
export async function markOrderSeen(orderId: string): Promise<void> {
  const user = await getAuthUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .eq('customer_user_id', user.id)
    .single()

  if (!data) return

  await supabase
    .from('orders')
    .update({ customer_seen_status: data.status })
    .eq('id', orderId)
    .eq('customer_user_id', user.id)
}

/**
 * Fetch the next page of notifications for the current user.
 * Used by the Load More button in NotificationList.
 */
export async function fetchOlderNotifications(offset: number) {
  const user = await getAuthUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const notifications = data ?? []
  return { notifications, hasMore: notifications.length === PAGE_SIZE }
}
