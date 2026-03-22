'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Trash2, Plus, Minus, Store } from 'lucide-react'
import {
  getCart,
  removeFromCart,
  updateQuantity,
  getSubtotal,
  getItemCount,
  type Cart,
} from '@/lib/cart/store'

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCart(getCart())
    setMounted(true)

    function onUpdate() {
      setCart(getCart())
    }
    window.addEventListener('cart-updated', onUpdate)
    return () => window.removeEventListener('cart-updated', onUpdate)
  }, [])

  if (!mounted) return null

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!cart || cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My cart</h2>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-14 text-center space-y-4">
          <ShoppingCart size={40} className="mx-auto text-gray-300 dark:text-neutral-600" />
          <div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Your cart is empty</p>
            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">
              Browse stores and add items to get started.
            </p>
          </div>
          <Link
            href="/businesses"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <Store size={15} />
            Browse stores
          </Link>
        </div>
      </div>
    )
  }

  // ── Filled cart ────────────────────────────────────────────────────────────
  const currency = cart.currencyCode ?? 'USD'
  const subtotal = getSubtotal(cart)
  const itemCount = getItemCount(cart)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My cart</h2>

      {/* Store banner */}
      <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <Store size={15} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 dark:text-neutral-500">Ordering from</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {cart.businessName}
          </p>
        </div>
        <Link
          href={`/businesses/${cart.businessSlug}`}
          className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          View store
        </Link>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
        {cart.items.map((item) => (
          <div key={item.productId} className="px-4 py-4">
            {/* Name + line total */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug flex-1 min-w-0">
                {item.productName}
              </p>
              <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {fmtCurrency(item.unitPrice * item.quantity, currency)}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
              {fmtCurrency(item.unitPrice, currency)}
              {item.baseUnit && item.baseUnit !== 'unit'
                ? ` / ${item.baseUnit}`
                : ' each'}
            </p>

            {/* Qty controls + remove */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-7 text-center text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => removeFromCart(item.productId)}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + CTA */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
          </span>
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
            {fmtCurrency(subtotal, currency)}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          Delivery fee (if any) is calculated at checkout.
        </p>
        <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
              {fmtCurrency(subtotal, currency)}
            </span>
          </div>
          <Link
            href="/app/checkout"
            className="block w-full text-center px-4 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold transition-colors"
          >
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  )
}
