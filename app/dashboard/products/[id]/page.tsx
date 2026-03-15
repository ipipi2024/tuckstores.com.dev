import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProduct } from '../actions'

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!product) notFound()

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Products
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Edit product</h1>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form action={updateProduct.bind(null, id)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={product.name}
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product.description ?? ''}
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white resize-none"
          />
        </div>

        <div>
          <label htmlFor="selling_price" className="block text-sm font-medium mb-1">Selling price</label>
          <input
            id="selling_price"
            name="selling_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product.selling_price ?? ''}
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="barcode" className="block text-sm font-medium mb-1">Barcode</label>
          <input
            id="barcode"
            name="barcode"
            type="text"
            defaultValue={product.barcode ?? ''}
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Save changes
          </button>
          <Link
            href="/dashboard/products"
            className="px-5 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
