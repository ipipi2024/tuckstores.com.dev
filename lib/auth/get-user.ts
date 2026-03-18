import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the authenticated Supabase auth user.
 * Redirects to /login if not authenticated.
 * Use in server components and server actions that require authentication.
 */
export async function getAuthUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return user
}

/**
 * Returns the authenticated Supabase auth user, or null if not authenticated.
 * Does not redirect. Use when authentication is optional.
 */
export async function getAuthUserOrNull(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}
