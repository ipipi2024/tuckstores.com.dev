import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addProduct } from '../actions'
import CategorySelect from '../CategorySelect'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('product_categories')
    .select('name')
    .eq('user_id', user.id)
    .order('name')

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
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
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
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
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white resize-none"
          />
        </div>

        <div>
          <label htmlFor="selling_price" className="block text-sm font-medium mb-1">
            Selling price
          </label>
          <input
            id="selling_price"
            name="selling_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <CategorySelect categories={categories?.map((c) => c.name) ?? []} />
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
            className="px-5 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
