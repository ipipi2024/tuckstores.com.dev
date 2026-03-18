'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'business'
}

const MAX_SLUG_ATTEMPTS = 20
const MAX_OWNED_BUSINESSES = 10

async function findUniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`
    const { data } = await admin
      .from('businesses')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  // All retries exhausted — timestamp suffix is effectively always unique
  return `${base}-${Date.now()}`
}

export async function createBusiness(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const currency = (formData.get('currency_code') as string | null)?.trim() || 'USD'

  if (!name || name.length < 2) {
    redirect('/business/new?error=Business+name+must+be+at+least+2+characters')
  }

  const admin = createAdminClient()

  // Guard against runaway business creation per user
  const { count: ownedCount } = await admin
    .from('business_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')

  if ((ownedCount ?? 0) >= MAX_OWNED_BUSINESSES) {
    redirect('/business/new?error=You+have+reached+the+maximum+number+of+businesses')
  }

  // Resolve unique slug (bounded — falls back to timestamp suffix if all attempts taken)
  const slug = await findUniqueSlug(admin, slugify(name))

  // Look up the free_trial plan
  const { data: plan, error: planError } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('code', 'free_trial')
    .single()

  if (planError || !plan) {
    redirect('/business/new?error=Could+not+load+subscription+plans.+Please+try+again.')
  }

  // Insert business
  const { data: business, error: bizError } = await admin
    .from('businesses')
    .insert({
      name,
      slug,
      description,
      currency_code: currency,
      status: 'active',
    })
    .select('id, slug')
    .single()

  if (bizError || !business) {
    redirect(`/business/new?error=${encodeURIComponent(bizError?.message ?? 'Failed to create business')}`)
  }

  // Insert owner membership
  const { error: memberError } = await admin.from('business_memberships').insert({
    business_id: business.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  })

  if (memberError) {
    // Best-effort cleanup
    await admin.from('businesses').delete().eq('id', business.id)
    redirect(`/business/new?error=${encodeURIComponent(memberError.message)}`)
  }

  // Insert trial subscription (14-day trial)
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)

  await admin.from('business_subscriptions').insert({
    business_id: business.id,
    plan_id: plan.id,
    status: 'trialing',
    starts_at: new Date().toISOString(),
    trial_ends_at: trialEnd.toISOString(),
  })

  redirect(`/business/${business.slug}/dashboard`)
}
