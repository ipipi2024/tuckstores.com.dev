import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteCustomer } from './actions'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Customers</h1>
          </div>
          <Link
            href="/dashboard/customers/new"
            className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            + Add customer
          </Link>
        </div>

        {!customers || customers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border rounded-lg">
            No customers yet.{' '}
            <Link href="/dashboard/customers/new" className="text-black underline">
              Add your first one.
            </Link>
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50">
                <Link href={`/dashboard/customers/${customer.id}`} className="flex-1 min-w-0">
                  <p className="font-medium">{customer.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    {customer.phone && (
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    )}
                    {customer.email && (
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    )}
                  </div>
                </Link>
                <form action={deleteCustomer.bind(null, customer.id)}>
                  <button type="submit" className="text-sm text-red-400 hover:text-red-600 ml-4">
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
