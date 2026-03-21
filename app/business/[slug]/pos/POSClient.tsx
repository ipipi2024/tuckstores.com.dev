'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Plus, Minus, Trash2, ChevronRight,
  CheckCircle2, ArrowLeft, ShoppingCart, X, User, AlertCircle, LinkIcon,
} from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import type { CompleteSalePayload, CompleteSaleResult, SaleItem } from './actions'
import type { FoundCustomer, SearchCustomerResult } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  sku: string | null
  selling_price: number
  stock: number
}

type CartItem = {
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  discount_amount: number
  stock: number
}

type Screen = 'cart' | 'checkout' | 'receipt'

type ReceiptData = {
  saleId: string
  items: CartItem[]
  total: number
  paymentMethod: string
  paymentAmount: number
}

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'card',   label: 'Card' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'other',  label: 'Other' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function useFmt(currencyCode: string) {
  return useCallback(
    (n: number) =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(n),
    [currencyCode]
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  products: Product[]
  currencyCode: string
  completeSale: (payload: CompleteSalePayload) => Promise<CompleteSaleResult>
  searchCustomer: (query: string) => Promise<SearchCustomerResult>
  slug: string
}

export default function POSClient({ products, currencyCode, completeSale, searchCustomer, slug }: Props) {
  const fmt = useFmt(currencyCode)
  const router = useRouter()

  // Refresh product stock whenever the tab regains focus (lightweight: triggers RSC re-fetch)
  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  // ── Cart state ─────────────────────────────────────────────────────────────

  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [screen, setScreen] = useState<Screen>('cart')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Customer linking state ─────────────────────────────────────────────────
  // Tracks a linked registered user. Walk-in fields (customerName/customerPhone)
  // remain editable alongside — they become the snapshot even when a user is linked.

  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [showLinkSearch, setShowLinkSearch] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkResult, setLinkResult] = useState<
    | null                                          // not yet searched
    | { found: false }                             // searched, no result
    | { found: true; customer: FoundCustomer }     // found
  >(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [products, query])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unit_price - item.discount_amount, 0),
    [cart]
  )

  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart])

  // ── Cart mutations ─────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        const newQty = existing.quantity + 1
        if (newQty > existing.stock) return prev
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: newQty } : i
        )
      }
      if (product.stock <= 0) return prev
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit_price: product.selling_price,
          quantity: 1,
          discount_amount: 0,
          stock: product.stock,
        },
      ]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i
          const next = i.quantity + delta
          if (next <= 0) return null as unknown as CartItem
          if (next > i.stock) return i
          return { ...i, quantity: next }
        })
        .filter(Boolean)
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product_id !== productId))
  }

  function clearCart(skipConfirm = false) {
    if (!skipConfirm && cart.length > 0 && !window.confirm('Clear the cart?')) return
    setCart([])
    setQuery('')
    setPaymentMethod('cash')
    setCustomerName('')
    setCustomerPhone('')
    setNotes('')
    setError(null)
    setScreen('cart')
    // Reset customer linking state
    setCustomerUserId(null)
    setShowLinkSearch(false)
    setLinkQuery('')
    setLinkResult(null)
    setLinkError(null)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  // ── Customer linking ───────────────────────────────────────────────────────

  async function handleLinkSearch() {
    if (!linkQuery.trim() || linkSearching) return
    setLinkSearching(true)
    setLinkResult(null)
    setLinkError(null)

    const result = await searchCustomer(linkQuery.trim())

    setLinkSearching(false)
    if (!result.success) {
      setLinkError(result.error)
      return
    }
    if (!result.customer) {
      setLinkResult({ found: false })
      return
    }
    setLinkResult({ found: true, customer: result.customer })
  }

  function handleLink(customer: FoundCustomer) {
    setCustomerUserId(customer.userId)
    // Auto-fill name/phone from the registered user if the fields are empty
    if (!customerName && customer.displayName) setCustomerName(customer.displayName)
    if (!customerPhone && customer.phone)       setCustomerPhone(customer.phone)
    // Reset search panel
    setShowLinkSearch(false)
    setLinkQuery('')
    setLinkResult(null)
    setLinkError(null)
  }

  function handleUnlink() {
    setCustomerUserId(null)
  }

  function handleCancelLinkSearch() {
    setShowLinkSearch(false)
    setLinkQuery('')
    setLinkResult(null)
    setLinkError(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleCompleteSale() {
    if (!cart.length || submitting) return
    setSubmitting(true)
    setError(null)

    const payload: CompleteSalePayload = {
      items: cart.map((i): SaleItem => ({
        product_id:      i.product_id,
        product_name:    i.product_name,
        quantity:        i.quantity,
        unit_price:      i.unit_price,
        discount_amount: i.discount_amount,
      })),
      payments: [{ payment_method: paymentMethod, amount: cartTotal, reference: null }],
      customer_user_id:        customerUserId,
      customer_name_snapshot:  customerName.trim() || null,
      customer_phone_snapshot: customerPhone.trim() || null,
      notes:                   notes.trim() || null,
    }

    const result = await completeSale(payload)

    if (!result.success) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setReceipt({
      saleId:        result.saleId,
      items:         [...cart],
      total:         cartTotal,
      paymentMethod,
      paymentAmount: cartTotal,
    })
    setSubmitting(false)
    setScreen('receipt')
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const sectionLabel = 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide'

  // ── Receipt screen ─────────────────────────────────────────────────────────

  if (screen === 'receipt' && receipt) {
    return (
      <div className="max-w-sm mx-auto space-y-6 py-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sale complete</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {fmt(receipt.total)} · {receipt.paymentMethod}
          </p>
          {customerUserId && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Linked to registered account</p>
          )}
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-50 dark:divide-neutral-800">
          {receipt.items.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500">× {item.quantity}</p>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {fmt(item.quantity * item.unit_price - item.discount_amount)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmt(receipt.total)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/business/${slug}/sales/${receipt.saleId}`}
            className="flex-1 py-3 text-sm font-medium text-center border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            View receipt
          </Link>
          <button
            onClick={() => clearCart(true)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            New sale
          </button>
        </div>
      </div>
    )
  }

  // ── Checkout screen ────────────────────────────────────────────────────────

  if (screen === 'checkout') {
    return (
      <div className="max-w-sm mx-auto space-y-5 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setScreen('cart'); setError(null) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Checkout</h1>
        </div>

        {/* Order summary */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-50 dark:divide-neutral-800">
          {cart.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500">× {item.quantity}</p>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {fmt(item.quantity * item.unit_price - item.discount_amount)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmt(cartTotal)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <p className={sectionLabel}>Payment method</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  paymentMethod === m.value
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer (optional) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <User size={13} className="text-gray-400" />
            <p className={sectionLabel}>Customer <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span></p>
            {customerUserId && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 size={11} />
                Registered
              </span>
            )}
          </div>

          {/* Walk-in name + phone (always editable) */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputCls}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Registered user linking */}
          <div className="mt-3">
            {!customerUserId ? (
              <>
                {!showLinkSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowLinkSearch(true)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <LinkIcon size={11} />
                    Link registered account
                  </button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Find by phone or email (exact match)</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. +1234567890 or user@email.com"
                        value={linkQuery}
                        onChange={(e) => { setLinkQuery(e.target.value); setLinkResult(null); setLinkError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLinkSearch() }}
                        className={`${inputCls} flex-1`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleLinkSearch}
                        disabled={linkSearching || !linkQuery.trim()}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                      >
                        {linkSearching ? <Spinner className="w-4 h-4" /> : 'Find'}
                      </button>
                    </div>

                    {linkError && (
                      <p className="text-xs text-red-500 dark:text-red-400">{linkError}</p>
                    )}

                    {linkResult?.found === false && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No registered account found.</p>
                    )}

                    {linkResult?.found === true && (
                      <div className="flex items-center justify-between rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {linkResult.customer.displayName ?? linkResult.customer.email ?? 'Unknown'}
                          </p>
                          {linkResult.customer.phone && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{linkResult.customer.phone}</p>
                          )}
                          {linkResult.customer.isKnownCustomer && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">Existing customer</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLink(linkResult.customer)}
                          className="ml-3 shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Link
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCancelLinkSearch}
                      className="text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600 dark:text-green-400">
                  Linked to registered account
                </span>
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
                >
                  Unlink
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className={sectionLabel}>Notes <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span></p>
          <textarea
            rows={2}
            placeholder="Any notes for this sale"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} resize-none mt-2`}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleCompleteSale}
          disabled={submitting}
          className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="w-4 h-4" />
              Processing…
            </span>
          ) : `Complete sale · ${fmt(cartTotal)}`}
        </button>
      </div>
    )
  }

  // ── Cart + product grid (main screen) ──────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

      {/* Left: product search + grid */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Product grid */}
        {filteredProducts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-8">No products found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.product_id === product.id)
              const outOfStock = product.stock <= 0
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`relative text-left rounded-xl border p-3 transition-colors ${
                    outOfStock
                      ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                      : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm active:scale-[0.98]'
                  }`}
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                      {inCart.quantity}
                    </span>
                  )}
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight pr-6">{product.name}</p>
                  {product.sku && (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">#{product.sku}</p>
                  )}
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
                    {fmt(product.selling_price)}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    outOfStock
                      ? 'text-red-500'
                      : product.stock <= 5
                      ? 'text-amber-500'
                      : 'text-gray-400 dark:text-neutral-500'
                  }`}>
                    {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: cart panel */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Cart {cartCount > 0 && `(${cartCount})`}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => clearCart()}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <ShoppingCart size={24} className="mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-neutral-500">Cart is empty</p>
              <p className="text-xs text-gray-300 dark:text-neutral-600 mt-0.5">Tap a product to add it</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50 dark:divide-neutral-800 max-h-80 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums">
                        {fmt(item.unit_price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart total + checkout */}
              <div className="border-t border-gray-100 dark:border-neutral-800 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={() => setScreen('checkout')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Checkout
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
