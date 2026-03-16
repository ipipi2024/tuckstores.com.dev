import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/auth/actions'

export default async function SubscribePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-neutral-900 rounded-xl border dark:border-neutral-800 p-8 text-center space-y-5">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950 rounded-full flex items-center justify-center mx-auto text-2xl">
          🔒
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Subscription Required
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            Your monthly access has expired or hasn&apos;t been activated yet.
            Contact your TuckStores provider to renew for <strong>$10/month</strong>.
          </p>
        </div>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
        <form action={signOut}>
          <button className="text-sm text-gray-400 hover:text-black dark:hover:text-white underline transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
