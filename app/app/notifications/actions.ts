'use server'

import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30

/**
 * Mark a single notification as seen and keep all related badge state in sync.
 *
 * For customers acknowledging an order notification this also advances
 * orders.customer_seen_status so the orders badge decrements in the same
 * server round-trip — no separate markOrderSeen call needed anywhere.
 *
 * For vendors the order-seen block is skipped entirely (isCustomer = false).
 *
 * Returns the new authoritative unread count so the caller can update
 * NotificationProvider context without an extra fetch.
 *
 * revalidatePath is intentionally omitted — the returned count keeps the bell
 * badge accurate and avoids a needless background layout re-render on every click.
 */
export async function markNotificationSeen(
  id: string,
  isCustomer: boolean,
): Promise<number> {
  const user = await getAuthUser()
  const supabase = await createClient()

  // Mark notification read and retrieve its type + data in one shot.
  // The .is('read_at', null) guard makes this idempotent.
  const { data: notification } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('type, data')
    .single()

  // Sync orders.customer_seen_status for customers only, and only when an
  // order notification was actually just marked read (notification != null).
  if (isCustomer && notification) {
    const type = notification.type as string
    const data = notification.data as Record<string, string>
    const orderId = data?.order_id

    if ((type === 'order_status_changed' || type === 'order_placed') && orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .eq('customer_user_id', user.id)
        .single()

      if (order) {
        await supabase
          .from('orders')
          .update({ customer_seen_status: order.status })
          .eq('id', orderId)
          .eq('customer_user_id', user.id)
      }
    }
  }

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return count ?? 0
}

/**
 * Mark all notifications as read for the current customer, and simultaneously
 * clear the orders badge by advancing customer_seen_status on all orders.
 *
 * The two operations are always paired for customers so the bell badge and
 * orders badge stay in sync. Calling one without the other is the root cause
 * of stuck badges.
 */
export async function markAllCustomerNotificationsSeen(): Promise<void> {
  const user = await getAuthUser()
  const supabase = await createClient()

  await Promise.all([
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null),
    supabase.rpc('mark_customer_orders_seen', { p_user_id: user.id }),
  ])

  revalidatePath('/app', 'layout')
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
