import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAnnouncement } from '../actions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

// Default to current datetime in local ISO string for datetime-local input
function localISOString(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export default async function NewAnnouncementPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_announcements')) {
    redirect(`/business/${slug}/announcements?error=Insufficient+permissions`)
  }

  const now = localISOString(new Date())
  const action = createAnnouncement.bind(null, slug)

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/business/${slug}/announcements`}
          className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">New announcement</h1>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
          {decodeURIComponent(error)}
        </p>
      )}

      <form action={action} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. New products in stock!"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            name="body"
            required
            rows={5}
            maxLength={2000}
            placeholder="Write your announcement here…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Audience
          </label>
          <select
            name="audience_type"
            defaultValue="customers"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="customers">Customers</option>
            <option value="members">Members (staff only)</option>
            <option value="all">Everyone</option>
          </select>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            Customers see announcements from businesses they&apos;ve purchased from.
          </p>
        </div>

        {/* Publish at */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Publish at <span className="text-xs text-gray-400 font-normal">(defaults to now)</span>
          </label>
          <input
            name="published_at"
            type="datetime-local"
            defaultValue={now}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Expires at */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expires at <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            name="expires_at"
            type="datetime-local"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            Leave blank to keep the announcement live indefinitely.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
          >
            Publish announcement
          </button>
          <Link
            href={`/business/${slug}/announcements`}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
