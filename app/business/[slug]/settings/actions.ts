'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform, isAtLeastRole } from '@/lib/auth/permissions'

export async function updateBusinessSettings(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_settings')) {
    redirect(`/business/${slug}/settings?error=Insufficient+permissions`)
  }

  const name        = (formData.get('name') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const phone       = (formData.get('phone') as string | null)?.trim() || null
  const email       = (formData.get('email') as string | null)?.trim() || null

  if (!name) redirect(`/business/${slug}/settings?error=Business+name+is+required`)

  // Sensitive fields (currency, timezone, slug) may only be changed by admin or owner.
  // The DB RLS for businesses:update already enforces owner|admin; this check prevents
  // managers from submitting these fields and getting a silent no-op from the DB.
  const isAdmin = isAtLeastRole(ctx.membership.role, 'admin')

  const currencyCode = isAdmin
    ? (formData.get('currency_code') as string | null)?.trim().toUpperCase() ?? ctx.business.currency_code
    : ctx.business.currency_code

  const timezone = isAdmin
    ? (formData.get('timezone') as string | null)?.trim() ?? ctx.business.timezone
    : ctx.business.timezone

  const newSlug = isAdmin
    ? (formData.get('slug') as string | null)?.trim().toLowerCase() ?? ctx.business.slug
    : ctx.business.slug

  if (!currencyCode) redirect(`/business/${slug}/settings?error=Currency+code+is+required`)
  if (!timezone)     redirect(`/business/${slug}/settings?error=Timezone+is+required`)
  if (!newSlug)      redirect(`/business/${slug}/settings?error=Slug+is+required`)

  if (!/^[a-z0-9-]+$/.test(newSlug)) {
    redirect(`/business/${slug}/settings?error=${encodeURIComponent('Slug may only contain lowercase letters, numbers, and hyphens')}`)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('businesses')
    .update({ name, description, phone, email, currency_code: currencyCode, timezone, slug: newSlug })
    .eq('id', ctx.business.id)

  if (error) {
    const msg = error.code === '23505'
      ? 'That slug is already taken — choose a different one'
      : error.message
    redirect(`/business/${slug}/settings?error=${encodeURIComponent(msg)}`)
  }

  // Slug changed → redirect to new URL
  if (newSlug !== slug) {
    redirect(`/business/${newSlug}/settings?success=1`)
  }

  revalidatePath(`/business/${slug}/settings`)
  redirect(`/business/${slug}/settings?success=1`)
}

export async function updateDeliverySettings(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!isAtLeastRole(ctx.membership.role, 'admin')) {
    redirect(`/business/${slug}/settings?error=` + encodeURIComponent('Only admins can change delivery settings'))
  }

  const pickupEnabled   = formData.get('pickup_enabled')   === 'true'
  const deliveryEnabled = formData.get('delivery_enabled') === 'true'

  if (!pickupEnabled && !deliveryEnabled) {
    redirect(
      `/business/${slug}/settings?error=` +
      encodeURIComponent('At least one fulfillment method must be enabled')
    )
  }

  const deliveryFeeRaw      = formData.get('delivery_fee')        as string
  const freeAboveRaw        = formData.get('free_delivery_above') as string
  const estimatedPickup     = (formData.get('estimated_time_pickup')   as string)?.trim() || null
  const estimatedDelivery   = (formData.get('estimated_time_delivery') as string)?.trim() || null

  const deliveryFee    = parseFloat(deliveryFeeRaw ?? '0') || 0
  const freeAbove      = freeAboveRaw?.trim() ? parseFloat(freeAboveRaw) : null

  const admin = createAdminClient()
  const { error } = await admin
    .from('business_delivery_settings')
    .upsert(
      {
        business_id:             ctx.business.id,
        pickup_enabled:          pickupEnabled,
        delivery_enabled:        deliveryEnabled,
        delivery_fee:            deliveryFee,
        free_delivery_above:     freeAbove,
        estimated_time_pickup:   estimatedPickup,
        estimated_time_delivery: estimatedDelivery,
      },
      { onConflict: 'business_id' }
    )

  if (error) {
    redirect(`/business/${slug}/settings?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/business/${slug}/settings`)
  redirect(`/business/${slug}/settings?success=1`)
}
