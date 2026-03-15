import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items(*, products(name))')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Sales</h1>
          </div>
          <Link
            href="/dashboard/sales/new"
            className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            + New sale
          </Link>
        </div>

        {!sales || sales.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border rounded-lg">
            No sales yet.{' '}
            <Link href="/dashboard/sales/new" className="text-black underline">
              Record your first one.
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white">
                  <div>
                    <p className="font-medium">
                      {new Date(sale.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                    {sale.notes && (
                      <p className="text-sm text-gray-500">{sale.notes}</p>
                    )}
                  </div>
                  <p className="font-semibold">
                    {sale.total_amount != null
                      ? `$${Number(sale.total_amount).toFixed(2)}`
                      : '—'}
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
  )
}
