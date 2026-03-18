'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserMemberships } from '@/lib/auth/get-business-context'

/**
 * Post-auth redirect: sends users to the right destination based on
 * how many active business memberships they have.
 *
 *   0 memberships  → /business/select  (create or browse as customer)
 *   1 membership   → /business/[slug]/dashboard
 *   2+ memberships → /business/select  (choose which business)
 */
async function redirectAfterAuth(): Promise<never> {
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

  if (!email || !password) {
    redirect('/signup?error=Email+and+password+are+required')
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  })

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)

  redirect(`/verify-email?email=${encodeURIComponent(email)}`)
}

export async function verifyEmail(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const token = formData.get('token') as string

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  if (error) {
    redirect(
      `/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath('/', 'layout')

  // New users have no memberships — go to business selector
  redirect('/business/select')
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

  if (!email || !password) {
    redirect('/login?error=Email+and+password+are+required')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/', 'layout')
  await redirectAfterAuth()
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
