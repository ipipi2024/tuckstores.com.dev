/**
 * Next.js instrumentation hook — runs once at server startup (not per request).
 * Validates that all required environment variables are present so a misconfigured
 * deployment fails immediately with a clear message rather than crashing on the
 * first request that calls createAdminClient() or createClient().
 */
export async function register() {
  const required: string[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SECRET_KEY',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    )
  }
}
