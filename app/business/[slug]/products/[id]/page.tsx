import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateProduct, deleteProduct } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import DeleteProductButton from './DeleteProductButton'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function EditProductPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    redirect(`/business/${slug}/products`)
  }

  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, sku, barcode, selling_price, cost_price_default, is_active, category_id')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!product) {
    redirect(`/business/${slug}/products?error=Product+not+found`)
  }

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('business_id', ctx.business.id)
    .order('name')

  const currentCategory = categories?.find((c) => c.id === product.category_id)

  const action = updateProduct.bind(null, slug, id)

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link
          href={`/business/${slug}/products`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={14} />
          Back to Products
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Product</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={action} className="space-y-4">
        <Field label="Name" required>
          <input
            name="name"
            type="text"
            required
            autoFocus
            defaultValue={product.name}
            placeholder="e.g. Bottled Water 500ml"
            className={inputCls}
          />
        </Field>

        <Field label="Description">
          <textarea
            name="description"
            rows={2}
            defaultValue={product.description ?? ''}
            placeholder="Optional description"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU">
            <input name="sku" type="text" defaultValue={product.sku ?? ''} placeholder="e.g. BWA-500" className={inputCls} />
          </Field>
          <Field label="Barcode">
            <input name="barcode" type="text" defaultValue={product.barcode ?? ''} placeholder="e.g. 1234567890" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Selling price (${ctx.business.currency_code})`}>
            <input
              name="selling_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.selling_price ?? ''}
              placeholder="0.00"
              className={inputCls}
            />
          </Field>
          <Field label={`Cost price (${ctx.business.currency_code})`}>
            <input
              name="cost_price_default"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.cost_price_default ?? ''}
              placeholder="0.00"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Category">
          <input
            name="category_name"
            type="text"
            list="categories-list"
            defaultValue={currentCategory?.name ?? ''}
            placeholder="Type or select a category"
            className={inputCls}
          />
          <datalist id="categories-list">
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            Leave blank for uncategorised. A new category will be created if the name doesn&apos;t exist.
          </p>
        </Field>

        <Field label="Status">
          <select name="is_active" defaultValue={product.is_active ? 'true' : 'false'} className={inputCls}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
            Save changes
          </button>
          <Link href={`/business/${slug}/products`} className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      <div className="border-t border-gray-200 dark:border-neutral-800 pt-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Danger zone</h2>
        <DeleteProductButton slug={slug} id={id} productName={product.name} />
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
