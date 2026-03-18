import { getAuthUser } from '@/lib/auth/get-user'
import { createBusiness } from './actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SubmitButton from '@/components/ui/SubmitButton'

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await getAuthUser()
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <Link
            href="/business/select"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create your business
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You&apos;ll be the owner and can invite staff later.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={createBusiness} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Business name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              placeholder="e.g. Green Valley Store"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="What does your business sell?"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label
              htmlFor="currency_code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Currency
            </label>
            <select
              id="currency_code"
              name="currency_code"
              defaultValue="USD"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="INR">INR — Indian Rupee</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="AUD">AUD — Australian Dollar</option>
            </select>
          </div>

          <SubmitButton
            pendingText="Creating…"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            Create Business
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
