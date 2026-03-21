'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import SupplierPicker from './SupplierPicker'

type Product = { id: string; name: string; cost_price_default: number | null; measurement_type: string | null; base_unit: string | null }
type Supplier = { id: string; name: string }

type LineItem = {
  key: number
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
  measurement_type: string
  base_unit: string
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
  return { key: ++keyCounter, product_id: '', product_name: '', quantity: 1, unit_cost: 0, measurement_type: 'unit', base_unit: 'unit' }
}

const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function NewPurchaseForm({ action, products, suppliers, currencyCode, slug }: Props) {
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [submitting, setSubmitting] = useState(false)

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(n)

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
      const mtype = product.measurement_type ?? 'unit'
      updateLine(key, {
        product_id: product.id,
        product_name: product.name,
        unit_cost: product.cost_price_default ?? 0,
        measurement_type: mtype,
        base_unit: product.base_unit ?? 'unit',
        quantity: mtype !== 'unit' ? 0 : 1,
      })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    const validLines = lines.filter((l) => l.product_id && l.quantity > 0 && (l.measurement_type === 'unit' ? Number.isInteger(l.quantity) : true))
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Purchase details */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Details</p>
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
            <SupplierPicker suppliers={suppliers} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea name="notes" rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {/* Column headers — desktop only */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_130px_80px_36px] gap-3 px-5 py-2.5 bg-gray-50/60 dark:bg-neutral-800/40 border-b border-gray-100 dark:border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Product</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Qty</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Unit cost</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 text-right">Subtotal</span>
          <span />
        </div>

        {/* Mobile header */}
        <div className="sm:hidden px-5 py-2.5 border-b border-gray-100 dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Items</p>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-neutral-800">
          {lines.map((line) => {
            const lineTotal = line.quantity * line.unit_cost
            return (
              <div key={line.key} className="px-5 py-4">
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_80px_130px_80px_36px] gap-3 items-end">
                  <div>
                    <label className="sm:hidden block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product</label>
                    <select
                      value={line.product_id}
                      onChange={(e) => handleProductChange(line.key, e.target.value)}
                      className={inputCls}
                      required
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={line.measurement_type !== 'unit' ? '0.001' : '1'}
                      step={line.measurement_type !== 'unit' ? '0.001' : '1'}
                      value={line.quantity}
                      onChange={(e) => {
                        if (line.measurement_type !== 'unit') {
                          updateLine(line.key, { quantity: Math.max(0, Math.round(parseFloat(e.target.value) * 1000) / 1000 || 0) })
                        } else {
                          updateLine(line.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                      }}
                      placeholder={line.measurement_type !== 'unit' ? line.base_unit : 'Qty'}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
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
                  <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums text-right py-2">
                    {line.product_id ? fmt(lineTotal) : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    title="Remove line"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Mobile stacked layout */}
                <div className="sm:hidden space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label className={labelCls}>Product</label>
                      <select
                        value={line.product_id}
                        onChange={(e) => handleProductChange(line.key, e.target.value)}
                        className={inputCls}
                        required
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      className="mt-5 p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors flex-shrink-0"
                      title="Remove line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>
                        {line.measurement_type !== 'unit' ? `Qty (${line.base_unit})` : 'Qty'}
                      </label>
                      <input
                        type="number"
                        min={line.measurement_type !== 'unit' ? '0.001' : '1'}
                        step={line.measurement_type !== 'unit' ? '0.001' : '1'}
                        value={line.quantity}
                        onChange={(e) => {
                          if (line.measurement_type !== 'unit') {
                            updateLine(line.key, { quantity: Math.max(0, Math.round(parseFloat(e.target.value) * 1000) / 1000 || 0) })
                          } else {
                            updateLine(line.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                          }
                        }}
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
                  </div>
                  {line.product_id && (
                    <div className="flex justify-end">
                      <span className="text-xs text-gray-400 dark:text-neutral-500">
                        Subtotal: <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{fmt(lineTotal)}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer: add line + running total */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus size={14} />
            Add line
          </button>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Total:{' '}
            <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || lines.every((l) => !l.product_id)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
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
