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
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black">
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
          <div className="text-center py-16 text-gray-400 border rounded-lg">
            No products yet.{' '}
            <Link href="/dashboard/products/new" className="text-black underline">
              Add your first one.
            </Link>
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.description && (
                    <p className="text-sm text-gray-500">{product.description}</p>
                  )}
                  {product.barcode && (
                    <p className="text-xs text-gray-400 mt-0.5">Barcode: {product.barcode}</p>
                  )}
                </div>
                <form action={deleteProduct.bind(null, product.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-400 hover:text-red-600"
                  >
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
