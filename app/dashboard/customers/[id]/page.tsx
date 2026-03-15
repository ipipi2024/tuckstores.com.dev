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
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard/customers" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Customers
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{customer.name}</h1>
        <div className="flex gap-4 mt-1">
          {customer.phone && <p className="text-sm text-gray-500 dark:text-neutral-400">{customer.phone}</p>}
          {customer.email && <p className="text-sm text-gray-500 dark:text-neutral-400">{customer.email}</p>}
        </div>
        {customer.notes && (
          <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">{customer.notes}</p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border dark:border-neutral-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Total purchases</p>
          <p className="text-2xl font-semibold mt-1">{sales?.length ?? 0}</p>
        </div>
        <div className="border dark:border-neutral-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Total spent</p>
          <p className="text-2xl font-semibold mt-1">${totalSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Purchase history */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700 dark:text-neutral-300">Purchase history</h2>
        {!sales || sales.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No purchases recorded for this customer yet.</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900">
                  <p className="text-sm text-gray-500 dark:text-neutral-400">
                    {new Date(sale.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="font-semibold">
                    ${Number(sale.total_amount ?? 0).toFixed(2)}
                  </p>
                </div>
                {sale.sale_items?.length > 0 && (
                  <div className="border-t dark:border-neutral-700 divide-y dark:divide-neutral-700 bg-gray-50 dark:bg-neutral-800">
                    {sale.sale_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-700 dark:text-neutral-300">{item.products?.name}</span>
                        <span className="text-gray-500 dark:text-neutral-400">
                          {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                          {' '}
                          <span className="text-black dark:text-white font-medium">
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
  )
}
