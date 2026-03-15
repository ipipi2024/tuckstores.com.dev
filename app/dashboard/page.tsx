import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-black underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <p className="text-gray-600">
          Signed in as <span className="font-medium text-black">{user.email}</span>
        </p>
      </div>
    </div>
  )
}
