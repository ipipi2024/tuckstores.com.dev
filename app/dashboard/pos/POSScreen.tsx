'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { completeSale, registerWalkInCustomer, linkSaleToCustomer } from './actions'

// ─── Types ───────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  selling_price: number | null
  stock: number | null
}

type Customer = {
  id: string
  name: string
}

type CartItem = {
  product_id: string
  name: string
  unit_price: number
  quantity: number
}

type PostSaleState =
  | { phase: 'prompt'; total: number; saleId: string }
  | { phase: 'form';   total: number; saleId: string }
  | { phase: 'select'; total: number; saleId: string }
  | { phase: 'done';   name: string }
  | null

// ─── CustomerPicker ───────────────────────────────────────────────────────────

type CustomerPickerProps = {
  customers: Customer[]
  onSelect: (customer: Customer) => void
  onClose: () => void
  loading?: boolean
  error?: string | null
}

function CustomerPicker({ customers, onSelect, onClose, loading, error }: CustomerPickerProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, query])

  return (
    <div className="w-full space-y-3">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers…"
        className="w-full border dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:bg-neutral-800 placeholder-gray-400"
      />
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>
      )}
      <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-xl border dark:border-neutral-700">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400 dark:text-neutral-500">No customers found</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              disabled={loading}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {c.name}
            </button>
          ))
        )}
      </div>
      <button
        onClick={onClose}
        className="w-full py-1.5 text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      >
        Back
      </button>
    </div>
  )
}

// ─── CartPanel ────────────────────────────────────────────────────────────────

type CartPanelProps = {
  cart: CartItem[]
  cartCount: number
  cartTotal: number
  onUpdateQty: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onCheckout: () => void
  onClose?: () => void
  submitting: boolean
  error: string | null
}

function CartPanel({
  cart, cartCount, cartTotal,
  onUpdateQty, onRemove, onCheckout,
  onClose, submitting, error,
}: CartPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (onClose) closeRef.current?.focus() }, [onClose])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b dark:border-neutral-800">
        <h2 className="font-semibold">
          Cart{' '}
          {cart.length > 0 && (
            <span className="text-sm font-normal text-gray-400 dark:text-neutral-500">
              · {cartCount} item{cartCount !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        {onClose && (
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-black dark:hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close cart"
          >
            ×
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500 p-8 text-center leading-relaxed">
          Tap a product card<br />to add it to the cart
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center gap-2 px-4 py-3 border-b dark:border-neutral-800 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    ${item.unit_price.toFixed(2)} each
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onUpdateQty(item.product_id, -1)}
                    className="w-8 h-8 rounded-full border dark:border-neutral-600 flex items-center justify-center text-base font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-90 transition-transform"
                    aria-label={`Decrease ${item.name}`}
                  >−</button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQty(item.product_id, 1)}
                    className="w-8 h-8 rounded-full border dark:border-neutral-600 flex items-center justify-center text-base font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-90 transition-transform"
                    aria-label={`Increase ${item.name}`}
                  >+</button>
                </div>
                <span className="w-14 text-right text-sm font-medium tabular-nums flex-shrink-0">
                  ${(item.unit_price * item.quantity).toFixed(2)}
                </span>
                <button
                  onClick={() => onRemove(item.product_id)}
                  className="ml-1 flex-shrink-0 text-gray-300 dark:text-neutral-600 hover:text-red-400 text-xl leading-none w-6 h-6 flex items-center justify-center"
                  aria-label={`Remove ${item.name}`}
                >×</button>
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 border-t dark:border-neutral-800 px-4 py-4 space-y-3">
            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500 dark:text-neutral-400">Total</span>
              <span className="text-2xl font-bold tabular-nums">${cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              disabled={submitting}
              className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-base"
            >
              {submitting ? 'Recording sale…' : 'Complete sale'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── PostSalePanel (desktop) ──────────────────────────────────────────────────

type PostSalePanelProps = {
  postSale: PostSaleState
  customers: Customer[]
  regName: string
  setRegName: (v: string) => void
  onRegister: () => void
  onRequestForm: () => void
  onRequestSelect: () => void
  onLinkCustomer: (customer: Customer) => void
  onSkip: () => void
  regSubmitting: boolean
  regError: string | null
  regInputRef: React.RefObject<HTMLInputElement | null>
}

function PostSalePanel({
  postSale, customers, regName, setRegName,
  onRegister, onRequestForm, onRequestSelect, onLinkCustomer, onSkip,
  regSubmitting, regError, regInputRef,
}: PostSalePanelProps) {
  if (!postSale) return null

  if (postSale.phase === 'done') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
        <span className="text-3xl">✓</span>
        <p className="font-semibold">{postSale.name}</p>
        <p className="text-sm text-gray-400 dark:text-neutral-500">Ready for next sale</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <p className="text-green-600 dark:text-green-400 font-semibold text-sm">
          ✓ ${postSale.total.toFixed(2)} recorded
        </p>
        <p className="font-semibold text-base">Link a customer?</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          Optional — attach this sale to a customer
        </p>
      </div>

      {postSale.phase === 'select' ? (
        <CustomerPicker
          customers={customers}
          onSelect={onLinkCustomer}
          onClose={onRequestForm.bind(null)}
          loading={regSubmitting}
          error={regError}
        />
      ) : postSale.phase === 'form' ? (
        <div className="w-full space-y-2.5">
          {regError && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">{regError}</p>
          )}
          <input
            ref={regInputRef}
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRegister() }}
            placeholder="Customer name"
            className="w-full border dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:bg-neutral-800 placeholder-gray-400"
          />
          <button
            onClick={onRegister}
            disabled={!regName.trim() || regSubmitting}
            className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {regSubmitting ? 'Saving…' : 'Save customer'}
          </button>
          <button
            onClick={onSkip}
            className="w-full py-1.5 text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>
      ) : (
        // prompt phase
        <div className="w-full space-y-2.5">
          <button
            onClick={onRequestSelect}
            className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all"
          >
            Select existing customer
          </button>
          <button
            onClick={onRequestForm}
            className="w-full py-2.5 border dark:border-neutral-700 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all"
          >
            Register new customer
          </button>
          <button
            onClick={onSkip}
            className="w-full py-1.5 text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

// ─── POSScreen ────────────────────────────────────────────────────────────────

export default function POSScreen({ products, customers }: { products: Product[]; customers: Customer[] }) {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Post-sale state
  const [postSale, setPostSale] = useState<PostSaleState>(null)
  const [regName, setRegName] = useState('')
  const [regSubmitting, setRegSubmitting] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [regSheetOpen, setRegSheetOpen] = useState(false)

  const regInputRef = useRef<HTMLInputElement>(null)

  // Auto-dismiss "done" state after 3s
  useEffect(() => {
    if (postSale?.phase !== 'done') return
    const t = setTimeout(() => setPostSale(null), 3000)
    return () => clearTimeout(t)
  }, [postSale])

  // Auto-focus name input when form phase activates
  useEffect(() => {
    if (postSale?.phase === 'form') {
      setTimeout(() => regInputRef.current?.focus(), 80)
    }
  }, [postSale?.phase])

  // Close cart drawer on desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setCartOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Derived values
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const cartTotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  // Cart mutations
  const addToCart = useCallback((product: Product) => {
    if (product.selling_price === null) return
    if (product.stock !== null && product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        // Don't exceed available stock
        if (product.stock !== null && existing.quantity >= product.stock) return prev
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: product.selling_price!,
        quantity: 1,
      }]
    })
  }, [])

  const updateQty = useCallback((product_id: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.product_id !== product_id) return [item]
        const newQty = item.quantity + delta
        if (newQty <= 0) return []
        // Cap increases at available stock
        if (delta > 0) {
          const product = products.find((p) => p.id === product_id)
          if (product?.stock !== null && product?.stock !== undefined && newQty > product.stock) {
            return [item]
          }
        }
        return [{ ...item, quantity: newQty }]
      })
    )
  }, [products])

  const removeItem = useCallback((product_id: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id))
  }, [])

  const getQty = (product_id: string) =>
    cart.find((i) => i.product_id === product_id)?.quantity ?? 0

  // Checkout
  async function handleCheckout() {
    if (!cart.length || submitting) return
    setSubmitting(true)
    setError(null)
    const total = cartTotal
    const result = await completeSale(
      cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }))
    )
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      setCart([])
      setCartOpen(false)
      setPostSale({ phase: 'prompt', total, saleId: result.saleId })
    }
  }

  // Post-sale: request form (register new)
  function requestRegForm() {
    if (!postSale || postSale.phase === 'done') return
    const { total, saleId } = postSale as { total: number; saleId: string }
    setPostSale({ phase: 'form', total, saleId })
    setRegSheetOpen(true)
  }

  // Post-sale: request select existing
  function requestSelectCustomer() {
    if (!postSale || postSale.phase === 'done') return
    const { total, saleId } = postSale as { total: number; saleId: string }
    setPostSale({ phase: 'select', total, saleId })
    setRegSheetOpen(true)
  }

  // Post-sale: link existing customer
  async function handleLinkCustomer(customer: Customer) {
    if (!postSale || postSale.phase === 'done') return
    const { saleId } = postSale as { saleId: string }
    setRegSubmitting(true)
    setRegError(null)
    const result = await linkSaleToCustomer(saleId, customer.id)
    setRegSubmitting(false)
    if (result?.error) {
      setRegError(result.error)
    } else {
      setRegSheetOpen(false)
      setPostSale({ phase: 'done', name: `Linked to ${customer.name}` })
    }
  }

  // Post-sale: register new customer
  async function handleRegister() {
    if (!regName.trim() || regSubmitting) return
    setRegSubmitting(true)
    setRegError(null)
    const result = await registerWalkInCustomer(regName.trim())
    setRegSubmitting(false)
    if (result?.error) {
      setRegError(result.error)
    } else {
      const name = regName.trim()
      setRegName('')
      setRegSheetOpen(false)
      setPostSale({ phase: 'done', name: `${name} registered` })
    }
  }

  function skipRegistration() {
    setPostSale(null)
    setRegName('')
    setRegError(null)
    setRegSheetOpen(false)
  }

  const cartPanelProps: CartPanelProps = {
    cart, cartCount, cartTotal,
    onUpdateQty: updateQty,
    onRemove: removeItem,
    onCheckout: handleCheckout,
    submitting, error,
  }

  const postSalePanelProps: PostSalePanelProps = {
    postSale, customers, regName, setRegName,
    onRegister: handleRegister,
    onRequestForm: requestRegForm,
    onRequestSelect: requestSelectCustomer,
    onLinkCustomer: handleLinkCustomer,
    onSkip: skipRegistration,
    regSubmitting, regError, regInputRef,
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col lg:flex-row bg-white dark:bg-neutral-950 text-black dark:text-white">

      {/* ── Left panel ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

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
                const hasPrice = product.selling_price !== null
                const outOfStock = product.stock !== null && product.stock <= 0
                const canAdd = hasPrice && !outOfStock
                const inCart = qty > 0
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={!canAdd}
                    className={[
                      'relative flex flex-col items-start text-left p-3.5 rounded-xl border transition-all active:scale-95 min-h-[84px]',
                      canAdd
                        ? inCart
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                          : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-500 hover:shadow-sm'
                        : 'bg-gray-50 dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 opacity-50 cursor-not-allowed',
                    ].join(' ')}
                    aria-label={`Add ${product.name} to cart`}
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
                    <span className={['text-sm font-bold mt-2', inCart ? 'text-white/70 dark:text-black/50' : 'text-black dark:text-white'].join(' ')}>
                      {hasPrice ? `$${product.selling_price!.toFixed(2)}` : 'No price'}
                    </span>
                    {product.stock !== null && (
                      <span className={['text-xs mt-0.5', inCart ? 'text-white/50 dark:text-black/40' : product.stock <= 0 ? 'text-red-400' : 'text-gray-400 dark:text-neutral-500'].join(' ')}>
                        {product.stock <= 0 ? 'Out of stock' : `${product.stock} left`}
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
        {postSale ? (
          <PostSalePanel {...postSalePanelProps} />
        ) : (
          <CartPanel {...cartPanelProps} />
        )}
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <div className="lg:hidden flex-shrink-0 border-t dark:border-neutral-800 bg-white dark:bg-neutral-950">

        {/* Post-sale: done */}
        {postSale?.phase === 'done' && (
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
            <span className="font-medium text-sm">{postSale.name}</span>
            <span className="text-xs text-gray-400 dark:text-neutral-500">· Ready for next sale</span>
          </div>
        )}

        {/* Post-sale: prompt / form / select */}
        {(postSale?.phase === 'prompt' || postSale?.phase === 'form' || postSale?.phase === 'select') && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                ✓ ${postSale.total.toFixed(2)} recorded
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Link a customer?</p>
            </div>
            <button
              onClick={requestSelectCustomer}
              className="flex-shrink-0 px-3 py-2 border dark:border-neutral-700 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 active:scale-95 transition-all"
            >
              Existing
            </button>
            <button
              onClick={requestRegForm}
              className="flex-shrink-0 px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-95 transition-all"
            >
              New
            </button>
            <button
              onClick={skipRegistration}
              className="flex-shrink-0 text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white px-2 py-2 transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* Normal: empty cart */}
        {!postSale && cart.length === 0 && (
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-gray-400 dark:text-neutral-500">Cart is empty</span>
            <Link
              href="/dashboard/sales"
              className="text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white"
            >
              View sales →
            </Link>
          </div>
        )}

        {/* Normal: cart has items */}
        {!postSale && cart.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              aria-label={`Open cart — ${cartCount} items, $${cartTotal.toFixed(2)}`}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
              <span className="font-semibold tabular-nums">${cartTotal.toFixed(2)}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500 truncate">tap to review</span>
            </button>
            <button
              onClick={handleCheckout}
              disabled={submitting}
              className="flex-shrink-0 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '…' : 'Checkout'}
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile cart drawer ── */}
      {cartOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cart"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setCartOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative flex flex-col bg-white dark:bg-neutral-950 rounded-t-2xl max-h-[85vh] shadow-2xl">
            <CartPanel {...cartPanelProps} onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Mobile customer sheet (register new or select existing) ── */}
      {regSheetOpen && (postSale?.phase === 'form' || postSale?.phase === 'select') && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={postSale.phase === 'select' ? 'Select customer' : 'Register customer'}
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) skipRegistration() }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-950 rounded-t-2xl px-5 pt-5 pb-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">
                  {postSale.phase === 'select' ? 'Select existing customer' : 'Register new customer'}
                </h3>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {postSale.phase === 'select' ? 'Link this sale to an existing customer' : 'Name only — they can add details later'}
                </p>
              </div>
              <button
                onClick={skipRegistration}
                className="text-xl text-gray-400 hover:text-black dark:hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800"
                aria-label="Close"
              >×</button>
            </div>

            {postSale.phase === 'select' ? (
              <CustomerPicker
                customers={customers}
                onSelect={handleLinkCustomer}
                onClose={() => { const { total, saleId } = postSale; setPostSale({ phase: 'prompt', total, saleId }); setRegSheetOpen(false) }}
                loading={regSubmitting}
                error={regError}
              />
            ) : (
              <>
                {regError && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{regError}</p>
                )}
                <input
                  ref={regInputRef}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRegister() }}
                  placeholder="e.g. John Doe"
                  className="w-full border dark:border-neutral-700 rounded-xl px-4 py-3 text-base bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:bg-neutral-800 placeholder-gray-400"
                />
                <button
                  onClick={handleRegister}
                  disabled={!regName.trim() || regSubmitting}
                  className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 transition-all text-base"
                >
                  {regSubmitting ? 'Saving…' : 'Save customer'}
                </button>
                <button
                  onClick={skipRegistration}
                  className="w-full py-1 text-sm text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white text-center transition-colors"
                >
                  Skip — don&apos;t register
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
