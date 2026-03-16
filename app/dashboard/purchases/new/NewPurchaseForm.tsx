'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = { id: string; name: string; stock: number | null }
type Supplier = { id: string; name: string }

type CartItem = {
  product_id: string
  name: string
  quantity: number
  unit_cost: string
}

// ─── PurchasePanel ────────────────────────────────────────────────────────────

type PurchasePanelProps = {
  cart: CartItem[]
  cartCount: number
  cartTotal: number
  suppliers: Supplier[]
  supplierId: string
  setSupplierId: (v: string) => void
  purchaseDate: string
  setPurchaseDate: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  addingSupplier: boolean
  setAddingSupplier: (v: boolean) => void
  newSupplierName: string
  setNewSupplierName: (v: string) => void
  supplierError: string | null
  supplierSubmitting: boolean
  onAddSupplier: () => void
  onUpdateQty: (id: string, delta: number) => void
  onUpdateCost: (id: string, value: string) => void
  onRemove: (id: string) => void
  onSubmit: () => void
  onClose?: () => void
  submitting: boolean
  error: string | null
}

function PurchasePanel({
  cart, cartCount, cartTotal,
  suppliers, supplierId, setSupplierId,
  purchaseDate, setPurchaseDate,
  notes, setNotes,
  addingSupplier, setAddingSupplier,
  newSupplierName, setNewSupplierName,
  supplierError, supplierSubmitting, onAddSupplier,
  onUpdateQty, onUpdateCost, onRemove,
  onSubmit, onClose, submitting, error,
}: PurchasePanelProps) {
  const inputClass = 'w-full border dark:border-neutral-700 rounded-xl px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:bg-neutral-800 placeholder-gray-400'
  const selectClass = 'w-full border dark:border-neutral-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b dark:border-neutral-800">
        <h2 className="font-semibold">
          Purchase
          {cartCount > 0 && (
            <span className="text-sm font-normal text-gray-400 dark:text-neutral-500">
              {' '}· {cartCount} item{cartCount !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-black dark:hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close panel"
          >×</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Metadata */}
        <div className="px-4 py-3 space-y-3 border-b dark:border-neutral-800">
          {/* Supplier */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              Supplier
            </label>
            {!addingSupplier ? (
              <>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— No supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingSupplier(true)}
                  className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  + Not listed? Add quickly
                </button>
              </>
            ) : (
              <div className="space-y-1.5">
                {supplierError && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">
                    {supplierError}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onAddSupplier() }}
                    placeholder="Supplier name"
                    autoFocus
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={onAddSupplier}
                    disabled={!newSupplierName.trim() || supplierSubmitting}
                    className="px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl disabled:opacity-50"
                  >
                    {supplierSubmitting ? '…' : 'Add'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setAddingSupplier(false); setNewSupplierName('') }}
                  className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. bulk order, invoice #123"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Items */}
        {cart.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500 p-8 text-center leading-relaxed">
            Tap a product card<br />to add it to the purchase
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[1fr_auto_92px_24px] gap-2 px-4 py-2 text-xs text-gray-400 dark:text-neutral-500 border-b dark:border-neutral-800">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit cost</span>
              <span />
            </div>
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="grid grid-cols-[1fr_auto_92px_24px] gap-2 items-center px-4 py-2.5 border-b dark:border-neutral-800 last:border-0"
              >
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQty(item.product_id, -1)}
                    className="w-7 h-7 rounded-full border dark:border-neutral-600 flex items-center justify-center text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-90 transition-transform"
                    aria-label={`Decrease ${item.name}`}
                  >−</button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQty(item.product_id, 1)}
                    className="w-7 h-7 rounded-full border dark:border-neutral-600 flex items-center justify-center text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-90 transition-transform"
                    aria-label={`Increase ${item.name}`}
                  >+</button>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) => onUpdateCost(item.product_id, e.target.value)}
                    placeholder="0.00"
                    className="w-full border dark:border-neutral-700 rounded-lg pl-5 pr-2 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:bg-neutral-800 tabular-nums"
                  />
                </div>
                <button
                  onClick={() => onRemove(item.product_id)}
                  className="text-gray-300 dark:text-neutral-600 hover:text-red-400 text-xl leading-none w-6 h-6 flex items-center justify-center"
                  aria-label={`Remove ${item.name}`}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 border-t dark:border-neutral-800 px-4 py-4 space-y-3">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500 dark:text-neutral-400">Total</span>
            <span className="text-2xl font-bold tabular-nums">${cartTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-base"
          >
            {submitting ? 'Saving…' : 'Record purchase'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NewPurchaseForm({
  products,
  suppliers: initialSuppliers,
  onSubmit,
  onQuickAddSupplier,
}: {
  products: Product[]
  suppliers: Supplier[]
  onSubmit: (
    items: { product_id: string; quantity: number; unit_cost: number }[],
    supplierId: string | null,
    purchaseDate: string,
    notes: string | null,
  ) => Promise<{ error: string } | null>
  onQuickAddSupplier: (name: string) => Promise<{ error: string } | { id: string; name: string }>
}) {
  const router = useRouter()

  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [supplierError, setSupplierError] = useState<string | null>(null)
  const [supplierSubmitting, setSupplierSubmitting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const cartTotal = cart.reduce((sum, i) => sum + (parseFloat(i.unit_cost) || 0) * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product_id: product.id, name: product.name, quantity: 1, unit_cost: '' }]
    })
  }, [])

  const updateQty = useCallback((product_id: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.product_id !== product_id) return [item]
        const newQty = item.quantity + delta
        return newQty <= 0 ? [] : [{ ...item, quantity: newQty }]
      })
    )
  }, [])

  const updateCost = useCallback((product_id: string, value: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === product_id ? { ...item, unit_cost: value } : item
      )
    )
  }, [])

  const removeItem = useCallback((product_id: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id))
  }, [])

  const getQty = (product_id: string) =>
    cart.find((i) => i.product_id === product_id)?.quantity ?? 0

  async function handleSubmit() {
    if (!cart.length || submitting) return
    const missingCost = cart.find((i) => !i.unit_cost || parseFloat(i.unit_cost) <= 0)
    if (missingCost) {
      setError(`Enter a unit cost for "${missingCost.name}"`)
      setPanelOpen(true)
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await onSubmit(
      cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: parseFloat(i.unit_cost) })),
      supplierId || null,
      purchaseDate,
      notes || null,
    )
    setSubmitting(false)
    if (result?.error) {
      setError(result.error)
      setPanelOpen(true)
    } else {
      router.push('/dashboard/purchases')
    }
  }

  async function handleAddSupplier() {
    if (!newSupplierName.trim() || supplierSubmitting) return
    setSupplierSubmitting(true)
    setSupplierError(null)
    const result = await onQuickAddSupplier(newSupplierName.trim())
    setSupplierSubmitting(false)
    if ('error' in result) {
      setSupplierError(result.error)
    } else {
      setSuppliers((prev) => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(result.id)
      setNewSupplierName('')
      setAddingSupplier(false)
    }
  }

  const panelProps = {
    cart, cartCount, cartTotal,
    suppliers, supplierId, setSupplierId,
    purchaseDate, setPurchaseDate,
    notes, setNotes,
    addingSupplier, setAddingSupplier,
    newSupplierName, setNewSupplierName,
    supplierError, supplierSubmitting,
    onAddSupplier: handleAddSupplier,
    onUpdateQty: updateQty,
    onUpdateCost: updateCost,
    onRemove: removeItem,
    onSubmit: handleSubmit,
    submitting, error,
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col lg:flex-row bg-white dark:bg-neutral-950 text-black dark:text-white">

      {/* ── Left panel ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b dark:border-neutral-800">
          <Link
            href="/dashboard/purchases"
            className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
            aria-label="Back to purchases"
          >←</Link>
          <span className="font-semibold text-lg flex-1">New Purchase</span>
          <ThemeToggle />
        </div>

        {/* Search */}
        <div className="flex-shrink-0 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border-b dark:border-neutral-800">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            autoComplete="off"
            className="w-full bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white placeholder-gray-400 dark:placeholder:text-neutral-500"
          />
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400 dark:text-neutral-500">
              {search
                ? `No products matching "${search}"`
                : 'No products yet — add some in Products.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {filtered.map((product) => {
                const qty = getQty(product.id)
                const inCart = qty > 0
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={[
                      'relative flex flex-col items-start text-left p-3.5 rounded-xl border transition-all active:scale-95 min-h-[72px]',
                      inCart
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-500 hover:shadow-sm',
                    ].join(' ')}
                    aria-label={`Add ${product.name} to purchase`}
                    aria-pressed={inCart}
                  >
                    {inCart && (
                      <span
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white dark:bg-black text-black dark:text-white text-[10px] font-bold flex items-center justify-center shadow"
                        aria-hidden="true"
                      >
                        {qty}
                      </span>
                    )}
                    <span className="font-medium text-sm leading-snug pr-6 line-clamp-2">
                      {product.name}
                    </span>
                    {product.stock !== null && (
                      <span className={[
                        'text-xs mt-1.5',
                        inCart
                          ? 'text-white/50 dark:text-black/40'
                          : product.stock <= 0
                            ? 'text-orange-400'
                            : 'text-gray-400 dark:text-neutral-500',
                      ].join(' ')}>
                        {product.stock <= 0 ? 'Out of stock' : `${product.stock} in stock`}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop right panel ── */}
      <div className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 border-l dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <PurchasePanel {...panelProps} />
      </div>

      {/* ── Mobile bottom bar ── */}
      <div className="lg:hidden flex-shrink-0 border-t dark:border-neutral-800 bg-white dark:bg-neutral-950">
        {cart.length === 0 ? (
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-gray-400 dark:text-neutral-500">No items yet</span>
            <Link
              href="/dashboard/purchases"
              className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white"
            >
              Cancel
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              aria-label={`Review purchase — ${cartCount} items`}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
              <span className="font-semibold tabular-nums">${cartTotal.toFixed(2)}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500 truncate">tap to review</span>
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-shrink-0 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '…' : 'Record'}
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile panel drawer ── */}
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Purchase details"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative flex flex-col bg-white dark:bg-neutral-950 rounded-t-2xl max-h-[90vh] shadow-2xl">
            <PurchasePanel {...panelProps} onClose={() => setPanelOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
