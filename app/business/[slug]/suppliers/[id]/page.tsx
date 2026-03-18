import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateSupplier, deleteSupplier } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import DeleteSupplierButton from './DeleteSupplierButton'
import SubmitButton from '@/components/ui/SubmitButton'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function EditSupplierPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_suppliers')) {
    redirect(`/business/${slug}/suppliers`)
  }

  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone, address, notes')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!supplier) {
    redirect(`/business/${slug}/suppliers?error=Supplier+not+found`)
  }

  const action = updateSupplier.bind(null, slug, id)

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link
          href={`/business/${slug}/suppliers`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={14} />
          Back to Suppliers
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
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
            defaultValue={supplier.name}
            placeholder="e.g. ABC Wholesalers"
            className={inputCls}
          />
        </Field>

        <Field label="Contact name">
          <input
            name="contact_name"
            type="text"
            defaultValue={supplier.contact_name ?? ''}
            placeholder="e.g. Jane Smith"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={supplier.email ?? ''}
              placeholder="e.g. orders@abc.com"
              className={inputCls}
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              defaultValue={supplier.phone ?? ''}
              placeholder="e.g. +1 555 000 0000"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Address">
          <textarea
            name="address"
            rows={2}
            defaultValue={supplier.address ?? ''}
            placeholder="Optional address"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field label="Notes">
          <textarea
            name="notes"
            rows={2}
            defaultValue={supplier.notes ?? ''}
            placeholder="Optional notes"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingText="Saving…" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            Save changes
          </SubmitButton>
          <Link href={`/business/${slug}/suppliers`} className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      <div className="border-t border-gray-200 dark:border-neutral-800 pt-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Danger zone</h2>
        <DeleteSupplierButton slug={slug} id={id} supplierName={supplier.name} />
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
