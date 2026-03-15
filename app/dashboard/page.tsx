import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <p className="text-gray-600 dark:text-neutral-400">
          Signed in as <span className="font-medium text-black dark:text-white">{user.email}</span>
        </p>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <Link
            href="/dashboard/products"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Products</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Manage your product catalogue</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
          <Link
            href="/dashboard/purchases"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Purchases</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Record stock coming in and track inventory</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
          <Link
            href="/dashboard/inventory"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Inventory</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">View current stock levels and movement log</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
          <Link
            href="/dashboard/sales"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Sales</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Record sales and update inventory</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
          <Link
            href="/dashboard/customers"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Customers</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Manage customers and view purchase history</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
          <Link
            href="/dashboard/suppliers"
            className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div>
              <p className="font-medium">Suppliers</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Manage suppliers and view order history</p>
            </div>
            <span className="text-gray-400 dark:text-neutral-500">→</span>
          </Link>
        </div>
    </div>
  )
}
