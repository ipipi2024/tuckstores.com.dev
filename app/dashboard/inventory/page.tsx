import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const movementTypeStyles: Record<string, string> = {
  purchase:   'bg-green-50 text-green-700',
  sale:       'bg-blue-50 text-blue-700',
  return:     'bg-yellow-50 text-yellow-700',
  adjustment: 'bg-gray-100 text-gray-600',
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: movements }, { data: stock }] = await Promise.all([
    supabase
      .from('inventory_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('product_stock')
      .select('product_id, stock_quantity, products(name)'),
  ])

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Inventory</h1>
        </div>

        {/* Stock levels */}
        <div className="space-y-3">
          <h2 className="font-medium text-gray-700">Current stock</h2>
          {!stock || stock.length === 0 ? (
            <p className="text-sm text-gray-400">No stock data yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              {stock.map((row: any) => (
                <div key={row.product_id} className="flex items-center justify-between px-4 py-3 bg-white">
                  <span className="text-sm font-medium">{row.products?.name}</span>
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
          <h2 className="font-medium text-gray-700">Movement log</h2>
          {!movements || movements.length === 0 ? (
            <p className="text-sm text-gray-400">No movements recorded yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              {movements.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${movementTypeStyles[m.movement_type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {m.movement_type}
                    </span>
                    <span className="text-sm">{m.products?.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                    <span className="text-gray-400">
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
    </div>
  )
}
