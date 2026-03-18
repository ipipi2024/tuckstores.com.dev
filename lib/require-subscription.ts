/**
 * DEPRECATED — This module is a compilation stub only.
 * The legacy /dashboard/* routes that import this will be deleted in Phase C.
 * Do not use this function in new code.
 * Subscription gating is now handled via isSubscriptionActive() in
 * lib/auth/get-business-context.ts, scoped to business_subscriptions.
 */
export async function requireSubscription(
  _supabase: unknown,
  _user: unknown,
): Promise<void> {
  throw new Error(
    'requireSubscription is deprecated. Use business subscription checks via getBusinessContext.'
  )
}
