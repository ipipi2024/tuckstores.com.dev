import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitVendorApplication } from './actions'
import SubmitButton from '@/components/ui/SubmitButton'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default async function VendorApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>
}) {
  const user = await getAuthUser()
  const { error, submitted } = await searchParams

  const admin = createAdminClient()

  // Load vendor profile fields
  const { data: profile } = await admin
    .from('users')
    .select('is_vendor_approved, store_limit, full_name')
    .eq('id', user.id)
    .single()

  // If already approved, send them to create a business
  if (profile?.is_vendor_approved) {
    redirect('/business/new')
  }

  // Load existing application
  const { data: application } = await admin
    .from('vendor_applications')
    .select('status, admin_notes, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

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
            Become a Vendor
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Apply for approval to create and manage stores on TuckStores.
          </p>
        </div>

        {/* Pending state */}
        {application?.status === 'pending' && (
          <div className="rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              Application under review
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Your application was submitted and is waiting for admin review. We&apos;ll get back to you soon.
            </p>
          </div>
        )}

        {/* Rejected state */}
        {application?.status === 'rejected' && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Application not approved
            </p>
            {application.admin_notes && (
              <p className="text-sm text-red-700 dark:text-red-400">
                {application.admin_notes}
              </p>
            )}
          </div>
        )}

        {/* Success after submit */}
        {submitted === '1' && !application && (
          <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
            <p className="text-sm text-green-700 dark:text-green-300">
              Application submitted! We&apos;ll review it and notify you.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{decodeURIComponent(error)}</p>
          </div>
        )}

        {/* Application form — only if no existing application */}
        {!application && submitted !== '1' && (
          <form action={submitVendorApplication} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={profile?.full_name ?? ''}
                placeholder="e.g. John Smith"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                What do you plan to sell? <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Briefly describe your business or products…"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <SubmitButton
              pendingText="Submitting…"
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              Submit Application
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
