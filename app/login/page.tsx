import Link from 'next/link'
import { signIn } from '@/app/auth/actions'
import SubmitButton from '@/components/ui/SubmitButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">TuckStores</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 space-y-5">
          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">{error}</p>
          )}

          <form action={signIn} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
              />
            </div>

            <SubmitButton
              pendingText="Signing in…"
              className="w-full bg-black dark:bg-white text-white dark:text-black rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mt-1 disabled:opacity-60"
            >
              Sign in
            </SubmitButton>
          </form>
        </div>

        <p className="text-sm text-center text-gray-500 dark:text-neutral-400 mt-5">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-black dark:text-white font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
