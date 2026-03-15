import Link from 'next/link'
import { addCustomer } from '../actions'

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/dashboard/customers" className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white">
          ← Customers
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Add customer</h1>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form action={addCustomer} className="space-y-4">
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
          <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
          >
            Save customer
          </button>
          <Link
            href="/dashboard/customers"
            className="px-5 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
