import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addProduct } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, ImageIcon } from 'lucide-react'
import SubmitButton from '@/components/ui/SubmitButton'
import CategoryPicker from './CategoryPicker'
import MeasurementPicker from './MeasurementPicker'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function NewProductPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    redirect(`/business/${slug}/products`)
  }

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('business_id', ctx.business.id)
    .order('name')

  const action = addProduct.bind(null, slug)

  return (
    <div className="max-w-lg space-y-5">
      {/* Back + title */}
      <div>
        <Link
          href={`/business/${slug}/products`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Products
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add product</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Fill in the details below. You can add images after saving.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Section: Basic information */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Basic information
          </h2>

          <Field label="Name" required>
            <input
              name="name"
              type="text"
              required
              autoFocus
              placeholder="e.g. Bottled Water 500ml"
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              rows={2}
              placeholder="Optional description"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU">
              <input name="sku" type="text" placeholder="e.g. BWA-500" className={inputCls} />
            </Field>
            <Field label="Barcode">
              <input name="barcode" type="text" placeholder="e.g. 1234567890" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Section: Pricing */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Pricing &amp; measurement
          </h2>
          <MeasurementPicker currencyCode={ctx.business.currency_code} />
        </section>

        {/* Section: Organisation */}
        <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Organisation
          </h2>
          <Field label="Category">
            <CategoryPicker categories={categories ?? []} />
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Leave blank for uncategorised. Choosing &ldquo;Add new category…&rdquo; will create it automatically.
            </p>
          </Field>
          <Field label="Status">
            <select name="is_active" defaultValue="true" className={inputCls}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </section>

        {/* Save actions */}
        <div className="flex gap-3">
          <SubmitButton
            pendingText="Saving…"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            Save product
          </SubmitButton>
          <Link
            href={`/business/${slug}/products`}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Images note */}
      <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 px-4 py-3.5">
        <ImageIcon size={15} className="text-gray-400 dark:text-neutral-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          Images can be added once the product is saved.
        </p>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
