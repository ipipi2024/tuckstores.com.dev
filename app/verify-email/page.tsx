import { verifyEmail, resendVerification } from '@/app/auth/actions'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; resent?: string }>
}) {
  const { email, error, resent } = await searchParams

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
        <p className="text-sm text-gray-500 dark:text-neutral-400">Invalid verification link.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">TuckStores</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Check your email</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 space-y-5">
          <p className="text-sm text-gray-600 dark:text-neutral-400 text-center">
            We sent a verification code to <span className="font-medium text-black dark:text-white">{email}</span>. Enter it below to confirm your account.
          </p>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">{error}</p>
          )}

          {resent && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">A new code has been sent to your email.</p>
          )}

          <form action={verifyEmail} className="space-y-4">
            <input type="hidden" name="email" value={email} />
            <div>
              <label htmlFor="token" className="block text-sm font-medium mb-1.5">
                Verification code
              </label>
              <input
                id="token"
                name="token"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="Enter 6-digit code"
                className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white dark:placeholder:text-neutral-500 tracking-widest text-center"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-black dark:bg-white text-white dark:text-black rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Verify email
            </button>
          </form>

          <div className="border-t border-gray-100 dark:border-neutral-800 pt-4">
            <p className="text-sm text-gray-500 dark:text-neutral-400 text-center mb-3">Didn&apos;t receive a code or it expired?</p>
            <form action={resendVerification}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Resend code
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
