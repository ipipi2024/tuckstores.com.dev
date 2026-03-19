/**
 * Shared notification dispatcher.
 *
 * All notification creation flows through here:
 *   1. Insert row(s) into the `notifications` table (always — source of truth).
 *   2. Fire Web Push to any registered push subscriptions (additive, fire-and-forget).
 *
 * Uses the admin client for DB writes so no client-side insertion is possible.
 * Never throws — a notification failure must never break the primary business action.
 */

import { createAdminClient } from './supabase/admin'

export type NotificationType =
  | 'new_message'
  | 'order_placed'
  | 'order_status_changed'

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  body: string
  /** Structured metadata; always include a `url` field for click navigation. */
  data: Record<string, string>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch a notification to a single user.
 */
export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('notifications').insert({
      user_id: payload.userId,
      type:    payload.type,
      title:   payload.title,
      body:    payload.body,
      data:    payload.data,
    })
    sendPushToUser(payload.userId, payload.title, payload.body, payload.data.url ?? '/').catch(() => {})
  } catch {
    // Never surface to caller
  }
}

/**
 * Dispatch a notification to all active members of a business.
 * Used for order_placed and new_message (customer → business) events.
 *
 * If `data.url` contains `{slug}`, it will be replaced with the business slug.
 */
export async function dispatchNotificationToBusinessMembers(
  businessId: string,
  payload: Omit<NotificationPayload, 'userId'>
): Promise<void> {
  try {
    const admin = createAdminClient()

    const [{ data: members }, { data: biz }] = await Promise.all([
      admin
        .from('business_memberships')
        .select('user_id')
        .eq('business_id', businessId)
        .eq('status', 'active'),
      admin
        .from('businesses')
        .select('slug')
        .eq('id', businessId)
        .single(),
    ])

    if (!members || members.length === 0) return

    const slug = biz?.slug ?? ''
    const resolvedData = {
      ...payload.data,
      url: (payload.data.url ?? '/').replace('{slug}', slug),
    }

    const rows = members.map((m) => ({
      user_id: m.user_id as string,
      type:    payload.type,
      title:   payload.title,
      body:    payload.body,
      data:    resolvedData,
    }))

    await admin.from('notifications').insert(rows)

    // Push each member — fire-and-forget
    for (const m of members) {
      sendPushToUser(
        m.user_id as string,
        payload.title,
        payload.body,
        resolvedData.url
      ).catch(() => {})
    }
  } catch {
    // Never surface to caller
  }
}

// ── Push delivery ─────────────────────────────────────────────────────────────

async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string
): Promise<void> {
  const { VAPID_EMAIL, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY } = process.env
  if (!VAPID_EMAIL || !VAPID_PRIVATE_KEY || !NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const pushPayload = JSON.stringify({ title, body, url })
  const staleIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) staleIds.push(sub.id)
      }
    })
  )

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds)
  }
}
