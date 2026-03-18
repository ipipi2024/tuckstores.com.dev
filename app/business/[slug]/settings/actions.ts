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
