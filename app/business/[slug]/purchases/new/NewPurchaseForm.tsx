'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'

type Product = { id: string; name: string; cost_price_default: number | null }
type Supplier = { id: string; name: string }

type LineItem = {
  key: number
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
}

type Props = {
  action: (formData: FormData) => Promise<void>
  products: Product[]
  suppliers: Supplier[]
  currencyCode: string
  slug: string
}

let keyCounter = 0

function newLine(): LineItem {
  return { key: ++keyCounter, product_id: '', product_name: '', quantity: 1, unit_cost: 0 }
}

export default function NewPurchaseForm({ action, products, suppliers, currencyCode, slug }: Props) {
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [submitting, setSubmitting] = useState(false)

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)

  function updateLine(key: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function handleProductChange(key: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (product) {
      updateLine(key, {
        product_id: product.id,
        product_name: product.name,
        unit_cost: product.cost_price_default ?? 0,
      })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    const validLines = lines.filter((l) => l.product_id && l.quantity > 0)
    if (!validLines.length) return

    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    formData.set(
      'items',
      JSON.stringify(
        validLines.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        }))
      )
    )

    try {
      await action(formData)
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(n)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header fields */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <input
              name="purchase_date"
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select name="supplier_id" className={inputCls}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea name="notes" rows={2} placeholder="Optional notes" className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</h2>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-neutral-800">
          {lines.map((line) => (
            <div key={line.key} className="px-5 py-4 grid grid-cols-[1fr_80px_120px_36px] gap-3 items-end">
              <div>
                <label className={labelCls}>Product</label>
                <select
                  value={line.product_id}
                  onChange={(e) => handleProductChange(line.key, e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Qty</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Unit cost ({currencyCode})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_cost}
                  onChange={(e) => updateLine(line.key, { unit_cost: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                className="mb-0.5 p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                title="Remove line"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus size={14} />
            Add line
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            Total: {fmt(total)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || lines.every((l) => !l.product_id)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="w-3.5 h-3.5" />
              Saving…
            </span>
          ) : 'Save purchase'}
        </button>
        <Link
          href={`/business/${slug}/purchases`}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
