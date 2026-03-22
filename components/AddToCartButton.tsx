'use client'

import { useState } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import {
  addToCart,
  clearCartAndAdd,
  type Cart,
} from '@/lib/cart/store'

type Props = {
  businessId: string
  businessSlug: string
  businessName: string
  currencyCode: string
  productId: string
  productName: string
  unitPrice: number
  baseUnit?: string
  className?: string
}

export default function AddToCartButton({
  businessId,
  businessSlug,
  businessName,
  currencyCode,
  productId,
  productName,
  unitPrice,
  baseUnit,
  className = '',
}: Props) {
  const [added, setAdded] = useState(false)
  const [conflict, setConflict] = useState<Cart | null>(null)

  function handleAdd() {
    const result = addToCart(businessId, businessSlug, businessName, currencyCode, {
      productId,
      productName,
      unitPrice,
      baseUnit,
    })

    if (result.conflict) {
      setConflict(result.existing)
      return
    }

    flashAdded()
  }

  function flashAdded() {
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  function handleConfirmSwitch() {
    clearCartAndAdd(businessId, businessSlug, businessName, currencyCode, {
      productId,
      productName,
      unitPrice,
      baseUnit,
    })
    setConflict(null)
    flashAdded()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          added
            ? 'bg-green-600 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        } ${className}`}
      >
        {added ? <Check size={15} /> : <ShoppingCart size={15} />}
        {added ? 'Added' : 'Add to cart'}
      </button>

      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Start a new cart?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your cart has items from{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {conflict.businessName}
              </span>
              . Adding from{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {businessName}
              </span>{' '}
              will clear the existing cart.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConflict(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Keep existing
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Start new cart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
