import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { addSupplier } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import SubmitButton from '@/components/ui/SubmitButton'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default async function NewSupplierPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_suppliers')) {
    redirect(`/business/${slug}/suppliers`)
  }

  const action = addSupplier.bind(null, slug)

  return (
    <div className="max-w-lg space-y-4">
      {/* Back + header */}
      <div>
        <Link
          href={`/business/${slug}/suppliers`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Suppliers
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add supplier</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add a new supplier to your directory.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Contact details */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Contact details</p>

          <div>
            <label className={labelCls}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              autoFocus
              placeholder="e.g. ABC Wholesalers"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Contact person</label>
            <input
              name="contact_name"
              type="text"
              placeholder="e.g. Jane Smith"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input
                name="email"
                type="email"
                placeholder="e.g. orders@abc.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                name="phone"
                type="tel"
                placeholder="e.g. +1 555 000 0000"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Additional info */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Additional info</p>

          <div>
            <label className={labelCls}>Address</label>
            <textarea
              name="address"
              rows={2}
              placeholder="Optional address…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Optional notes…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <SubmitButton
            pendingText="Saving…"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            Save supplier
          </SubmitButton>
          <Link
            href={`/business/${slug}/suppliers`}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
