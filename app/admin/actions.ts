'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function isAdmin(email: string | undefined) {
  return email === process.env.ADMIN_EMAIL
}

export async function approveVendor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) redirect('/')

  const applicationId = formData.get('application_id') as string
  const vendorUserId  = formData.get('vendor_user_id') as string
  const storeLimit    = parseInt(formData.get('store_limit') as string, 10) || 1
  const adminNotes    = (formData.get('admin_notes') as string | null)?.trim() || null

  const admin = createAdminClient()

  await Promise.all([
    admin.from('vendor_applications').update({
      status:      'approved',
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
    }).eq('id', applicationId),

    admin.from('users').update({
      is_vendor_approved: true,
      store_limit:        storeLimit,
    }).eq('id', vendorUserId),
  ])

  revalidatePath('/admin')
}

export async function rejectVendor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) redirect('/')

  const applicationId = formData.get('application_id') as string
  const vendorUserId  = formData.get('vendor_user_id') as string
  const adminNotes    = (formData.get('admin_notes') as string | null)?.trim() || null

  const admin = createAdminClient()

  await Promise.all([
    admin.from('vendor_applications').update({
      status:      'rejected',
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
    }).eq('id', applicationId),

    admin.from('users').update({
      is_vendor_approved: false,
      store_limit:        0,
    }).eq('id', vendorUserId),
  ])

  revalidatePath('/admin')
}

export async function grantSubscription(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) redirect('/')

  const businessId = formData.get('business_id') as string
  const planCode   = formData.get('plan_code') as string
  const months     = parseInt(formData.get('months') as string, 10) || 1

  const admin = createAdminClient()

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('code', planCode)
    .single()

  if (!plan) return

  // Extend from current expiry if still in future, else from now
  const { data: existing } = await admin
    .from('business_subscriptions')
    .select('expires_at')
    .eq('business_id', businessId)
    .maybeSingle()

  const base =
    existing?.expires_at && new Date(existing.expires_at) > new Date()
      ? new Date(existing.expires_at)
      : new Date()

  const newExpiry = new Date(base)
  newExpiry.setMonth(newExpiry.getMonth() + months)

  const { error } = await admin.from('business_subscriptions').upsert(
    {
      business_id: businessId,
      plan_id: plan.id,
      status: 'active',
      starts_at: new Date().toISOString(),
      expires_at: newExpiry.toISOString(),
      trial_ends_at: null,
    },
    { onConflict: 'business_id' }
  )

  if (error) {
    throw new Error(`Failed to grant subscription: ${error.message} (code: ${error.code})`)
  }

  revalidatePath('/admin')
}
