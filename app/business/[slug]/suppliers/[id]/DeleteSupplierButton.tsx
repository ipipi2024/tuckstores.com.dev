'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteSupplier } from '../actions'
import Spinner from '@/components/ui/Spinner'

type Props = { slug: string; id: string; supplierName: string }

export default function DeleteSupplierButton({ slug, id, supplierName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deleteSupplier(slug, id)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      setConfirming(false)
    } else {
      router.push(`/business/${slug}/suppliers`)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
      >
        Delete supplier
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Delete <span className="font-medium text-gray-900 dark:text-white">{supplierName}</span>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {loading ? <span className="inline-flex items-center gap-1.5"><Spinner className="w-3.5 h-3.5" />Deleting…</span> : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
