import Link from 'next/link'
import { forgotPassword } from '@/app/auth/actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">TuckStores</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Reset your password</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 space-y-5">
          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">{error}</p>
          )}

          {sent ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-700 dark:text-neutral-300">Check your email for a password reset link.</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500">If it doesn&apos;t arrive, check your spam folder.</p>
            </div>
          ) : (
            <form action={forgotPassword} className="space-y-4">
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
              <button
                type="submit"
                className="w-full bg-black dark:bg-white text-white dark:text-black rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Send reset link
              </button>
            </form>
          )}
        </div>

        <p className="text-sm text-center text-gray-500 dark:text-neutral-400 mt-5">
          <Link href="/login" className="text-black dark:text-white font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
