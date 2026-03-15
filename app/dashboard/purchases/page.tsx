import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PurchasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, purchase_items(*, products(name))')
    .order('purchase_date', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Purchases</h1>
          </div>
          <Link
            href="/dashboard/purchases/new"
            className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            + New purchase
          </Link>
        </div>

        {!purchases || purchases.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-neutral-500 border dark:border-neutral-700 rounded-lg">
            No purchases yet.{' '}
            <Link href="/dashboard/purchases/new" className="text-black dark:text-white underline">
              Record your first one.
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900">
                  <div>
                    <p className="font-medium">
                      {purchase.supplier_name ?? 'Unknown supplier'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                      {new Date(purchase.purchase_date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {purchase.total_amount != null
                      ? `$${Number(purchase.total_amount).toFixed(2)}`
                      : '—'}
                  </p>
                </div>

                {purchase.purchase_items?.length > 0 && (
                  <div className="border-t dark:border-neutral-700 divide-y dark:divide-neutral-700 bg-gray-50 dark:bg-neutral-800">
                    {purchase.purchase_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-700 dark:text-neutral-300">{item.products?.name}</span>
                        <span className="text-gray-500 dark:text-neutral-400">
                          {item.quantity} × ${Number(item.unit_cost).toFixed(2)}
                          {' '}
                          <span className="text-black dark:text-white font-medium">
                            = ${Number(item.subtotal).toFixed(2)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {purchase.notes && (
                  <div className="border-t dark:border-neutral-700 px-4 py-2 text-xs text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-800">
                    {purchase.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
