'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { isAtLeastRole } from '@/lib/auth/permissions'

const listPath = (slug: string) => `/business/${slug}/announcements`

/**
 * Parses a datetime-local string to an ISO string.
 * Returns null if the input is absent or not a valid date — prevents
 * RangeError from new Date('garbage').toISOString().
 */
function parseDatetimeOrNull(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim())
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * RLS for business_announcements INSERT/UPDATE/DELETE requires owner or admin.
 * permissions.ts also grants manage_announcements to manager, but those writes
 * would be silently blocked at the DB layer. We check isAtLeastRole('admin')
 * here to keep app behavior aligned with the current RLS policy.
 */
function canManageAnnouncements(role: string): boolean {
  return isAtLeastRole(role as Parameters<typeof isAtLeastRole>[0], 'admin')
}

export async function createAnnouncement(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)
  if (!canManageAnnouncements(ctx.membership.role)) {
    redirect(`${listPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${listPath(slug)}?error=Subscription+is+not+active`)
  }

  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) redirect('/login')

  const title        = (formData.get('title') as string | null)?.trim() ?? ''
  const body         = (formData.get('body') as string | null)?.trim() ?? ''
  const audienceType = (formData.get('audience_type') as string | null) ?? 'members'
  const publishedRaw = (formData.get('published_at') as string | null)?.trim()
  const expiresRaw   = (formData.get('expires_at') as string | null)?.trim()

  if (!title || !body) {
    redirect(`${listPath(slug)}/new?error=Title+and+body+are+required`)
  }
  if (title.length > 200) {
    redirect(`${listPath(slug)}/new?error=Title+must+be+200+characters+or+fewer`)
  }
  if (body.length > 4000) {
    redirect(`${listPath(slug)}/new?error=Message+must+be+4000+characters+or+fewer`)
  }

  const validAudiences = ['members', 'customers', 'all']
  if (!validAudiences.includes(audienceType)) {
    redirect(`${listPath(slug)}/new?error=Invalid+audience+type`)
  }

  // Safe datetime parsing — avoids RangeError on malformed input
  const publishedAt = parseDatetimeOrNull(publishedRaw) ?? new Date().toISOString()
  const expiresAt   = parseDatetimeOrNull(expiresRaw)
  if (expiresRaw?.trim() && !expiresAt) {
    redirect(`${listPath(slug)}/new?error=Invalid+expiry+date`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('business_announcements')
    .insert({
      business_id:        ctx.business.id,
      title,
      body,
      audience_type:      audienceType,
      created_by_user_id: user.id,
      published_at:       publishedAt,
      expires_at:         expiresAt,
    })

  if (error) {
    redirect(`${listPath(slug)}/new?error=Failed+to+create+announcement`)
  }

  redirect(`${listPath(slug)}?success=1`)
}

export async function expireAnnouncement(slug: string, announcementId: string) {
  const ctx = await getBusinessContext(slug)
  if (!canManageAnnouncements(ctx.membership.role)) {
    redirect(`${listPath(slug)}?error=Insufficient+permissions`)
  }

  const supabase = await createClient()
  await supabase
    .from('business_announcements')
    .update({ expires_at: new Date().toISOString() })
    .eq('id', announcementId)
    .eq('business_id', ctx.business.id)

  redirect(listPath(slug))
}

export async function deleteAnnouncement(slug: string, announcementId: string) {
  const ctx = await getBusinessContext(slug)
  if (!canManageAnnouncements(ctx.membership.role)) {
    redirect(`${listPath(slug)}?error=Insufficient+permissions`)
  }

  const supabase = await createClient()
  await supabase
    .from('business_announcements')
    .delete()
    .eq('id', announcementId)
    .eq('business_id', ctx.business.id)

  redirect(listPath(slug))
}
