import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: customer }, { data: sales }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('sales')
      .select('*, sale_items(*, products(name))')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!customer) notFound()

  const totalSpent = sales?.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0) ?? 0

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard/customers" className="text-sm text-gray-400 hover:text-black">
            ← Customers
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{customer.name}</h1>
          <div className="flex gap-4 mt-1">
            {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
            {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
          </div>
          {customer.notes && (
            <p className="text-sm text-gray-400 mt-1">{customer.notes}</p>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Total purchases</p>
            <p className="text-2xl font-semibold mt-1">{sales?.length ?? 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Total spent</p>
            <p className="text-2xl font-semibold mt-1">${totalSpent.toFixed(2)}</p>
          </div>
        </div>

        {/* Purchase history */}
        <div className="space-y-3">
          <h2 className="font-medium text-gray-700">Purchase history</h2>
          {!sales || sales.length === 0 ? (
            <p className="text-sm text-gray-400">No purchases recorded for this customer yet.</p>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => (
                <div key={sale.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-white">
                    <p className="text-sm text-gray-500">
                      {new Date(sale.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                    <p className="font-semibold">
                      ${Number(sale.total_amount ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {sale.sale_items?.length > 0 && (
                    <div className="border-t divide-y bg-gray-50">
                      {sale.sale_items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-gray-700">{item.products?.name}</span>
                          <span className="text-gray-500">
                            {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                            {' '}
                            <span className="text-black font-medium">
                              = ${Number(item.subtotal).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
