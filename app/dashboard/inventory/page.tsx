import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const movementTypeStyles: Record<string, string> = {
  purchase:   'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sale:       'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  return:     'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  adjustment: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400',
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: movements }, { data: products }] = await Promise.all([
    supabase
      .from('inventory_movements')
      .select('*, products(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, name')
      .eq('user_id', user.id),
  ])

  const productNameById = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))

  // aggregate stock per product from movements
  const stockMap: Record<string, number> = {}
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + Number(m.quantity)
  }
  const stock = Object.entries(stockMap)
    .map(([product_id, stock_quantity]) => ({ product_id, stock_quantity }))
    .sort((a, b) => (productNameById[a.product_id] ?? '').localeCompare(productNameById[b.product_id] ?? ''))

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Inventory</h1>
      </div>

      {/* Stock levels */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700 dark:text-neutral-300">Current stock</h2>
        {!stock || stock.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No stock data yet.</p>
        ) : (
          <div className="border dark:border-neutral-700 rounded-lg overflow-hidden divide-y dark:divide-neutral-700">
            {stock.map((row: any) => (
              <div key={row.product_id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900">
                <span className="text-sm font-medium">{productNameById[row.product_id] ?? 'Unknown product'}</span>
                <span className={`text-sm font-semibold ${Number(row.stock_quantity) <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {row.stock_quantity} units
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movement log */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700 dark:text-neutral-300">Movement log</h2>
        {!movements || movements.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No movements recorded yet.</p>
        ) : (
          <div className="border dark:border-neutral-700 rounded-lg overflow-hidden divide-y dark:divide-neutral-700">
            {movements.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${movementTypeStyles[m.movement_type] ?? 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                    {m.movement_type}
                  </span>
                  <span className="text-sm">{m.products?.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className={`font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                  <span className="text-gray-400 dark:text-neutral-500">
                    {new Date(m.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
