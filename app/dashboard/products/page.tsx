import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteProduct } from './actions'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Products</h1>
          </div>
          <Link
            href="/dashboard/products/new"
            className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            + Add product
          </Link>
        </div>

        {!products || products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-neutral-500 border dark:border-neutral-700 rounded-lg">
            No products yet.{' '}
            <Link href="/dashboard/products/new" className="text-black dark:text-white underline">
              Add your first one.
            </Link>
          </div>
        ) : (
          <div className="divide-y dark:divide-neutral-700 border dark:border-neutral-700 rounded-lg overflow-hidden">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.description && (
                    <p className="text-sm text-gray-500 dark:text-neutral-400">{product.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    {product.selling_price != null ? (
                      <p className="text-sm font-medium text-black dark:text-white">
                        ${Number(product.selling_price).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No price set</p>
                    )}
                    {product.barcode && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500">Barcode: {product.barcode}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="text-sm text-gray-400 hover:text-black dark:hover:text-white"
                  >
                    Edit
                  </Link>
                  <form action={deleteProduct.bind(null, product.id)}>
                    <button
                      type="submit"
                      className="text-sm text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
