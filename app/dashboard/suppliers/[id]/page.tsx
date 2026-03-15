import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: supplier }, { data: purchases }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
    supabase
      .from('purchases')
      .select('*, purchase_items(*, products(name))')
      .eq('supplier_id', id)
      .order('purchase_date', { ascending: false }),
  ])

  if (!supplier) notFound()

  const totalSpent = purchases?.reduce((sum, p) => sum + Number(p.total_amount ?? 0), 0) ?? 0
  const totalOrders = purchases?.length ?? 0

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard/suppliers" className="text-sm text-gray-400 hover:text-black">
          ← Suppliers
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{supplier.name}</h1>
        <div className="flex gap-4 mt-1">
          {supplier.phone && <p className="text-sm text-gray-500">{supplier.phone}</p>}
          {supplier.email && <p className="text-sm text-gray-500">{supplier.email}</p>}
        </div>
        {supplier.notes && (
          <p className="text-sm text-gray-400 mt-1">{supplier.notes}</p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total orders</p>
          <p className="text-2xl font-semibold mt-1">{totalOrders}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total purchased</p>
          <p className="text-2xl font-semibold mt-1">${totalSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Purchase history */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700">Purchase history</h2>
        {!purchases || purchases.length === 0 ? (
          <p className="text-sm text-gray-400">No purchases recorded for this supplier yet.</p>
        ) : (
          <div className="space-y-3">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white">
                  <p className="text-sm text-gray-500">
                    {new Date(purchase.purchase_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="font-semibold">
                    ${Number(purchase.total_amount ?? 0).toFixed(2)}
                  </p>
                </div>
                {purchase.purchase_items?.length > 0 && (
                  <div className="border-t divide-y bg-gray-50">
                    {purchase.purchase_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-700">{item.products?.name}</span>
                        <span className="text-gray-500">
                          {item.quantity} × ${Number(item.unit_cost).toFixed(2)}
                          {' '}
                          <span className="font-medium">
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
