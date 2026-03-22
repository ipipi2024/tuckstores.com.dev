import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Truck, AlertCircle } from 'lucide-react'
import SuppliersClient, { type SupplierEntry } from './SuppliersClient'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function SuppliersPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)
  const canManage = canPerform(ctx.membership.role, 'manage_suppliers')
  const supabase = await createClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone')
    .eq('business_id', ctx.business.id)
    .order('name')

  const entries: SupplierEntry[] = (suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    contact_name: s.contact_name,
    email: s.email,
    phone: s.phone,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck size={20} />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your supplier contacts and details.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/business/${slug}/suppliers/new`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add supplier
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <SuppliersClient suppliers={entries} slug={slug} canManage={canManage} />
    </div>
  )
}
