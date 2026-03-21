'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform, isAtLeastRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

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

  const countryCode = isAdmin
    ? (formData.get('country_code') as string | null)?.trim().toUpperCase() ?? ctx.business.country_code
    : ctx.business.country_code

  const timezone = isAdmin
    ? (formData.get('timezone') as string | null)?.trim() ?? ctx.business.timezone
    : ctx.business.timezone

  const newSlug = isAdmin
    ? (formData.get('slug') as string | null)?.trim().toLowerCase() ?? ctx.business.slug
    : ctx.business.slug

  const city = (formData.get('city') as string | null)?.trim() || null

  if (!currencyCode) redirect(`/business/${slug}/settings?error=Currency+code+is+required`)
  if (!countryCode)  redirect(`/business/${slug}/settings?error=Country+is+required`)
  if (!timezone)     redirect(`/business/${slug}/settings?error=Timezone+is+required`)
  if (!newSlug)      redirect(`/business/${slug}/settings?error=Slug+is+required`)

  if (!/^[a-z0-9-]+$/.test(newSlug)) {
    redirect(`/business/${slug}/settings?error=${encodeURIComponent('Slug may only contain lowercase letters, numbers, and hyphens')}`)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('businesses')
    .update({ name, description, phone, email, currency_code: currencyCode, country_code: countryCode, city, timezone, slug: newSlug })
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

export async function updateBusinessBranding(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_settings')) {
    redirect(`/business/${slug}/settings?error=Insufficient+permissions`)
  }

  const logoUrl         = (formData.get('logo_url')         as string | null) || null
  const logoPath        = (formData.get('logo_path')        as string | null) || null
  const coverImageUrl   = (formData.get('cover_image_url')  as string | null) || null
  const coverImagePath  = (formData.get('cover_image_path') as string | null) || null
  const catchline       = (formData.get('catchline')        as string | null)?.trim() || null

  // Fetch existing paths so we can delete orphaned storage files when images are removed
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('businesses')
    .select('logo_path, cover_image_path')
    .eq('id', ctx.business.id)
    .single()

  const admin = createAdminClient()

  // If logo was removed (existing path present, new path absent) — delete from storage
  if (existing?.logo_path && !logoPath && existing.logo_path !== logoPath) {
    await admin.storage.from('business-assets').remove([existing.logo_path])
  }

  // If cover was removed — delete from storage
  if (existing?.cover_image_path && !coverImagePath && existing.cover_image_path !== coverImagePath) {
    await admin.storage.from('business-assets').remove([existing.cover_image_path])
  }

  const { error } = await admin
    .from('businesses')
    .update({
      logo_url:         logoUrl,
      logo_path:        logoPath,
      cover_image_url:  coverImageUrl,
      cover_image_path: coverImagePath,
      catchline,
    })
    .eq('id', ctx.business.id)

  if (error) {
    redirect(`/business/${slug}/settings?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/business/${slug}/settings`)
  revalidatePath(`/businesses/${slug}`)
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
