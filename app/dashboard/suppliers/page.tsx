import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteSupplier } from './actions'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Suppliers</h1>
        </div>
        <Link
          href="/dashboard/suppliers/new"
          className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
        >
          + Add supplier
        </Link>
      </div>

      {!suppliers || suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border rounded-lg">
          No suppliers yet.{' '}
          <Link href="/dashboard/suppliers/new" className="text-black underline">
            Add your first one.
          </Link>
        </div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50">
              <Link href={`/dashboard/suppliers/${supplier.id}`} className="flex-1 min-w-0">
                <p className="font-medium">{supplier.name}</p>
                <div className="flex gap-3 mt-0.5">
                  {supplier.phone && <p className="text-sm text-gray-500">{supplier.phone}</p>}
                  {supplier.email && <p className="text-sm text-gray-500">{supplier.email}</p>}
                </div>
              </Link>
              <form action={deleteSupplier.bind(null, supplier.id)}>
                <button type="submit" className="text-sm text-red-400 hover:text-red-600 ml-4">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
