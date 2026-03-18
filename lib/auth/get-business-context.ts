import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { MembershipRole, MembershipStatus } from './permissions'

export type BusinessContext = {
  business: {
    id: string
    name: string
    slug: string
    status: string
    currency_code: string
    country_code: string
    timezone: string
  }
  membership: {
    id: string
    role: MembershipRole
    status: MembershipStatus
  }
  subscription: {
    status: string
    trial_ends_at: string | null
    expires_at: string | null
  } | null
}

/**
 * Loads the business record, the current user's active membership in that
 * business, and the business subscription — all in a single query.
 *
 * Redirects to:
 *   - /login                 if not authenticated
 *   - /business/select       if the user has no active membership in this business
 *
 * Use this at the top of every business-scoped server component or action.
 * The slug is the URL segment from /business/[slug]/...
 */
export const getBusinessContext = cache(async function _getBusinessContext(slug: string): Promise<BusinessContext> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Single query: join business → memberships → subscriptions
  const { data, error } = await supabase
    .from('businesses')
    .select(
      `
      id,
      name,
      slug,
      status,
      currency_code,
      country_code,
      timezone,
      business_memberships!inner (
        id,
        role,
        status
      ),
      business_subscriptions (
        status,
        trial_ends_at,
        expires_at
      )
    `
    )
    .eq('slug', slug)
    .eq('business_memberships.user_id', user.id)
    .eq('business_memberships.status', 'active')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load business context: ${error.message}`)
  }

  if (!data) {
    // Either the business doesn't exist or the user has no active membership
    redirect('/business/select')
  }

  const membership = data.business_memberships[0]
  const rawSub = data.business_subscriptions
  const subscription = Array.isArray(rawSub) ? (rawSub[0] ?? null) : (rawSub ?? null)

  return {
    business: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      status: data.status,
      currency_code: data.currency_code,
      country_code: data.country_code,
      timezone: data.timezone,
    },
    membership: {
      id: membership.id,
      role: membership.role as MembershipRole,
      status: membership.status as MembershipStatus,
    },
    subscription: subscription
      ? {
          status: subscription.status,
          trial_ends_at: subscription.trial_ends_at,
          expires_at: subscription.expires_at,
        }
      : null,
  }
})

/**
 * Returns true if the business context has an active or trialing subscription
 * that has not expired. Call after getBusinessContext for feature-gated routes.
 */
export function isSubscriptionActive(ctx: BusinessContext): boolean {
  const sub = ctx.subscription
  if (!sub) return false
  if (sub.status !== 'active' && sub.status !== 'trialing') return false
  const now = new Date()
  if (sub.expires_at && new Date(sub.expires_at) <= now) return false
  if (sub.trial_ends_at && new Date(sub.trial_ends_at) <= now) return false
  return true
}

/**
 * Returns the memberships for the current user across all businesses.
 * Used for post-login redirect logic and the business selector.
 *
 * Returns [] if not authenticated (does not redirect — callers decide).
 */
export async function getUserMemberships() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('business_memberships')
    .select(
      `
      id,
      role,
      status,
      businesses (
        id,
        name,
        slug,
        status,
        logo_url
      )
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data
    .filter((m) => m.businesses !== null)
    .map((m) => ({
      id: m.id as string,
      role: m.role as MembershipRole,
      status: m.status as MembershipStatus,
      businesses: m.businesses as unknown as {
        id: string
        name: string
        slug: string
        status: string
        logo_url: string | null
      },
    }))
}
