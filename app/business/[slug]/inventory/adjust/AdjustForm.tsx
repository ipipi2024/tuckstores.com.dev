'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Minus, Loader2, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react'

const REASONS = [
  'Opening stock',
  'Count correction',
  'Found extra stock',
  'Missing purchase history',
  'Damaged goods',
  'Expired goods',
  'Theft / shrinkage',
  'Other',
]

type Product = {
  id: string
  name: string
  sku: string | null
  measurement_type: string | null
  base_unit: string | null
}

type Props = {
  products: Product[]
  action: (formData: FormData) => Promise<void>
  error?: string
  stockMap: Record<string, number>
  defaultProductId?: string
}

function fmtStock(qty: number, baseUnit: string): string {
  if (baseUnit === 'unit') return String(Math.round(qty))
  return `${Number(qty).toFixed(3)} ${baseUnit}`
}

function SubmitButton({ direction }: { direction: 'in' | 'out' }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
        direction === 'in'
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-red-600 hover:bg-red-700 text-white'
      }`}
    >
      {pending ? (
        <><Loader2 size={15} className="animate-spin" />Saving…</>
      ) : direction === 'in' ? (
        <><Plus size={15} />Add stock</>
      ) : (
        <><Minus size={15} />Remove stock</>
      )}
    </button>
  )
}

export default function AdjustForm({ products, action, error, stockMap, defaultProductId }: Props) {
  const params = useParams<{ slug: string }>()
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [selectedProductId, setSelectedProductId] = useState(defaultProductId ?? '')
  const [quantityRaw, setQuantityRaw] = useState('')

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const isMeasurable = selectedProduct && (selectedProduct.measurement_type ?? 'unit') !== 'unit'
  const baseUnit = selectedProduct?.base_unit ?? 'unit'
  const qtyLabel = isMeasurable ? `Quantity (${baseUnit})` : 'Quantity'

  const currentStock = selectedProductId ? (stockMap[selectedProductId] ?? 0) : null
  const parsedQty = parseFloat(quantityRaw)
  const hasQty = !isNaN(parsedQty) && parsedQty > 0

  const projectedStock = currentStock !== null && hasQty
    ? currentStock + (direction === 'in' ? parsedQty : -parsedQty)
    : null

  const isOverdraw = direction === 'out' && currentStock !== null && hasQty && parsedQty > currentStock

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="direction" value={direction} />

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Direction toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Adjustment type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              direction === 'in'
                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
            }`}
          >
            <Plus size={15} />
            Add stock
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              direction === 'out'
                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
            }`}
          >
            <Minus size={15} />
            Remove stock
          </button>
        </div>
      </div>

      {/* Product */}
      <div>
        <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Product <span className="text-red-500">*</span>
        </label>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">
            No active products.{' '}
            <Link href={`/business/${params.slug}/products/new`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Add a product first.
            </Link>
          </p>
        ) : (
          <select
            id="product_id"
            name="product_id"
            required
            value={selectedProductId}
            onChange={(e) => { setSelectedProductId(e.target.value); setQuantityRaw('') }}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.sku ? ` (#${p.sku})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Current stock info — shown after product selection */}
      {selectedProduct && currentStock !== null && (
        <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium uppercase tracking-wide">Current stock</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${
              currentStock <= 0
                ? 'text-red-600 dark:text-red-400'
                : currentStock <= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-800 dark:text-gray-100'
            }`}>
              {fmtStock(currentStock, baseUnit)}
            </p>
          </div>

          {projectedStock !== null && (
            <div className="flex items-center gap-3">
              <ArrowRight size={16} className="text-gray-300 dark:text-neutral-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium uppercase tracking-wide">After adjustment</p>
                <p className={`text-lg font-bold tabular-nums mt-0.5 ${
                  projectedStock <= 0
                    ? 'text-red-600 dark:text-red-400'
                    : projectedStock <= 5
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {fmtStock(projectedStock, baseUnit)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overdraw warning */}
      {isOverdraw && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          This will push stock negative. Make sure this is intentional.
        </div>
      )}

      {/* Quantity */}
      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {qtyLabel} <span className="text-red-500">*</span>
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={isMeasurable ? '0.001' : '1'}
          step={isMeasurable ? '0.001' : '1'}
          required
          value={quantityRaw}
          onChange={(e) => setQuantityRaw(e.target.value)}
          placeholder={isMeasurable ? 'e.g. 2.500' : 'e.g. 10'}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Reason */}
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Reason <span className="text-red-500">*</span>
        </label>
        <select
          id="reason"
          name="reason"
          required
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Additional notes{' '}
          <span className="text-gray-400 dark:text-neutral-500 font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Any additional context…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Ledger notice */}
      <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        This creates an inventory adjustment entry and affects current stock immediately.
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Link
          href={`/business/${params.slug}/inventory`}
          className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </Link>
        <SubmitButton direction={direction} />
      </div>
    </form>
  )
}
