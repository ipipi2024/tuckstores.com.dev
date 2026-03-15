import Link from 'next/link'
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

        <div className="grid grid-cols-1 gap-3 pt-2">
          <Link
            href="/dashboard/products"
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="font-medium">Products</p>
              <p className="text-sm text-gray-500">Manage your product catalogue</p>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
          <Link
            href="/dashboard/purchases"
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="font-medium">Purchases</p>
              <p className="text-sm text-gray-500">Record stock coming in and track inventory</p>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
