import Link from 'next/link'
import { addProduct } from '../actions'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link href="/dashboard/products" className="text-sm text-gray-400 hover:text-black">
            ← Products
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Add product</h1>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <form action={addProduct} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          <div>
            <label htmlFor="barcode" className="block text-sm font-medium mb-1">
              Barcode
            </label>
            <input
              id="barcode"
              name="barcode"
              type="text"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
            >
              Save product
            </button>
            <Link
              href="/dashboard/products"
              className="px-5 py-2 border text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
