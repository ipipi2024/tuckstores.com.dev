'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserMemberships } from '@/lib/auth/get-business-context'
import { safeNext } from '@/lib/auth/safe-next'

/**
 * Post-auth redirect: if a safe `next` URL is provided, go there.
 * Otherwise, sends users to the right destination based on memberships.
 *
 *   0 memberships  → /business/select  (create or browse as customer)
 *   1 membership   → /business/[slug]/dashboard
 *   2+ memberships → /business/select  (choose which business)
 */
async function redirectAfterAuth(next?: string | null): Promise<never> {
  const safe = safeNext(next)
  if (safe) redirect(safe)

  const memberships = await getUserMemberships()

  if (memberships.length === 1) {
    redirect(`/business/${memberships[0].businesses.slug}/dashboard`)
  }

  redirect('/business/select')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string | null)?.trim() || null
  const next = safeNext(formData.get('next') as string | null)

  const nextQs = next ? `&next=${encodeURIComponent(next)}` : ''

  if (!email || !password) {
    redirect(`/signup?error=Email+and+password+are+required${nextQs}`)
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  })

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}${nextQs}`)

  redirect(`/verify-email?email=${encodeURIComponent(email)}${nextQs}`)
}

export async function verifyEmail(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const token = formData.get('token') as string
  const next = safeNext(formData.get('next') as string | null)

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  if (error) {
    const nextQs = next ? `&next=${encodeURIComponent(next)}` : ''
    redirect(
      `/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}${nextQs}`
    )
  }

  revalidatePath('/', 'layout')
  await redirectAfterAuth(next)
}

export async function resendVerification(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error) {
    redirect(
      `/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`
    )
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}&resent=1`)
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  if (!email) {
    redirect('/forgot-password?error=Email+is+required')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(error.message || JSON.stringify(error))}`
    )
  }

  redirect('/forgot-password?sent=1')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  if (!password || password.length < 8) {
    redirect('/reset-password?error=Password+must+be+at+least+8+characters')
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/', 'layout')
  await redirectAfterAuth()
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = safeNext(formData.get('next') as string | null)

  const nextQs = next ? `&next=${encodeURIComponent(next)}` : ''

  if (!email || !password) {
    redirect(`/login?error=Email+and+password+are+required${nextQs}`)
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}${nextQs}`)

  revalidatePath('/', 'layout')
  await redirectAfterAuth(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
