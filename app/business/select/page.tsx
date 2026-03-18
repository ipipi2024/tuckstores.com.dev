import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth/get-user'
import { getUserMemberships } from '@/lib/auth/get-business-context'
import { Building2, Plus, Store } from 'lucide-react'

export default async function BusinessSelectPage() {
  // Require authentication
  await getAuthUser()

  const memberships = await getUserMemberships()

  // Auto-redirect if exactly one active business
  if (memberships.length === 1) {
    redirect(`/business/${memberships[0].businesses.slug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {memberships.length === 0 ? 'Welcome to TouchStore' : 'Select a Business'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {memberships.length === 0
              ? 'Create a business to start selling, or browse as a customer.'
              : 'Choose which business to manage.'}
          </p>
        </div>

        {/* Business list */}
        {memberships.length > 0 && (
          <div className="space-y-2">
            {memberships.map((m) => (
              <Link
                key={m.id}
                href={`/business/${m.businesses.slug}/dashboard`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all"
              >
                {/* Logo or fallback */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center overflow-hidden">
                  {m.businesses.logo_url ? (
                    <img
                      src={m.businesses.logo_url}
                      alt={m.businesses.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {m.businesses.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                    {m.role}
                  </p>
                </div>

                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/business/new"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create a Business
          </Link>

          <Link
            href="/app"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Continue as Customer
          </Link>
        </div>
      </div>
    </div>
  )
}
