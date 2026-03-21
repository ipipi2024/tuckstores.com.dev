'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Trash2, Plus, Minus, Store } from 'lucide-react'
import {
  getCart,
  removeFromCart,
  updateQuantity,
  getSubtotal,
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

  if (!cart || cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cart</h2>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-12 text-center">
          <ShoppingCart size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-400 dark:text-neutral-500">Your cart is empty</p>
          <Link
            href="/businesses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Store size={14} />
            Browse stores
          </Link>
        </div>
      </div>
    )
  }

  const currency = cart.currencyCode ?? 'USD'
  const subtotal = getSubtotal(cart)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cart</h2>
        <span className="text-sm text-gray-400 dark:text-neutral-500">{cart.businessName}</span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
        {cart.items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                {fmtCurrency(item.unitPrice, currency)} each
              </p>
            </div>

            {/* Qty controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>

            <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums w-16 text-right">
              {fmtCurrency(item.unitPrice * item.quantity, currency)}
            </span>

            <button
              type="button"
              onClick={() => removeFromCart(item.productId)}
              className="text-gray-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Summary + CTA */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{fmtCurrency(subtotal, currency)}</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          Delivery fee (if any) is calculated at checkout.
        </p>
        <Link
          href="/app/checkout"
          className="block w-full text-center px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  )
}
