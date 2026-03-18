import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Truck, AlertCircle } from 'lucide-react'

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck size={20} />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {suppliers?.length ?? 0} supplier{suppliers?.length !== 1 ? 's' : ''}
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
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!suppliers || suppliers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Truck size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No suppliers yet.</p>
            {canManage && (
              <Link
                href={`/business/${slug}/suppliers/new`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus size={13} />
                Add your first supplier
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Contact</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Phone</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {s.contact_name ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="hover:underline text-indigo-600 dark:text-indigo-400">
                          {s.email}
                        </a>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {s.phone ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/suppliers/${s.id}`}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
