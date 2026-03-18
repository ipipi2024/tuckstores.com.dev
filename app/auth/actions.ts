'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.signUp({
    email,
    password: formData.get('password') as string,
  })

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)

  redirect(`/verify-email?email=${encodeURIComponent(email)}`)
}

export async function verifyEmail(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const token = formData.get('token') as string

  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })

  if (error) redirect(`/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function resendVerification(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error) redirect(`/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`)

  redirect(`/verify-email?email=${encodeURIComponent(email)}&resent=1`)
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
