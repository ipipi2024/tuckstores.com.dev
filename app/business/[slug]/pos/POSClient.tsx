'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Plus, Minus, Trash2, ChevronRight,
  CheckCircle2, ArrowLeft, ShoppingCart, X, User, AlertCircle
} from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import type { CompleteSalePayload, CompleteSaleResult, SaleItem } from './actions'

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
  slug: string
}

export default function POSClient({ products, currencyCode, completeSale, slug }: Props) {
  const fmt = useFmt(currencyCode)
  const router = useRouter()

  // Refresh product stock whenever the tab regains focus (lightweight: triggers RSC re-fetch)
  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  // State
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

  // Derived
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
        if (newQty > existing.stock) return prev // RPC will also enforce this
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: newQty } : i
        )
      }
      if (product.stock <= 0) return prev // block adding out-of-stock items
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
    setTimeout(() => searchRef.current?.focus(), 50)
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
      customer_user_id:        null,
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
            {fmt(receipt.total)} · {PAYMENT_METHODS.find((m) => m.value === receipt.paymentMethod)?.label ?? receipt.paymentMethod}
          </p>
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
          <button
            onClick={() => clearCart(true)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            New sale
          </button>
          <Link
            href={`/business/${slug}/sales/${receipt.saleId}`}
            className="flex-1 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            View receipt
          </Link>
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
          <div className="grid grid-cols-4 gap-2">
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
            <p className={sectionLabel}>Customer <span className="text-gray-400 font-normal">(optional)</span></p>
          </div>
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
        </div>

        {/* Notes */}
        <div>
          <p className={sectionLabel}>Notes <span className="text-gray-400 font-normal">(optional)</span></p>
          <textarea
            rows={2}
            placeholder="Any notes for this sale"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} resize-none`}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filteredProducts.map((product) => {
              const outOfStock = product.stock <= 0
              const inCart = cart.find((i) => i.product_id === product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => !outOfStock && addToCart(product)}
                  disabled={outOfStock}
                  className={`relative text-left p-3.5 rounded-xl border transition-all ${
                    outOfStock
                      ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
                      : inCart
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 hover:border-indigo-400'
                      : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug mb-1 line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: currencyCode,
                      minimumFractionDigits: 2,
                    }).format(product.selling_price)}
                  </p>
                  <p className={`text-xs mt-1 ${
                    outOfStock
                      ? 'text-red-500 dark:text-red-400'
                      : product.stock <= 5
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-400 dark:text-neutral-500'
                  }`}>
                    {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                  </p>
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: cart */}
      <div className="lg:w-72 xl:w-80 shrink-0">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden sticky top-4">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cart</span>
              {cartCount > 0 && (
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">
                  {cartCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => clearCart()}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-gray-400 dark:text-neutral-500">Cart is empty</p>
              <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Tap a product to add it</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50 dark:divide-neutral-800 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product_id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums">
                        {new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: currencyCode,
                          minimumFractionDigits: 2,
                        }).format(item.unit_price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-500 disabled:opacity-30 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart footer */}
              <div className="border-t border-gray-100 dark:border-neutral-800 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={() => setScreen('checkout')}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  Checkout
                  <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared style atoms ────────────────────────────────────────────────────────

const sectionLabel = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
