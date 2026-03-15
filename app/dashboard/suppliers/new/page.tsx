import Link from 'next/link'
import { addSupplier } from '../actions'

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/dashboard/suppliers" className="text-sm text-gray-400 hover:text-black">
          ← Suppliers
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Add supplier</h1>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form action={addSupplier} className="space-y-4">
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
          <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            Save supplier
          </button>
          <Link
            href="/dashboard/suppliers"
            className="px-5 py-2 border text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
