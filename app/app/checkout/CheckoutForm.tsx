'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Loader2, AlertCircle, MapPin, Store } from 'lucide-react'
import { getSubtotal, type Cart } from '@/lib/cart/store'

type DeliverySettings = {
  pickup_enabled: boolean
  delivery_enabled: boolean
  delivery_fee: number
  free_delivery_above: number | null
  estimated_time_pickup: string | null
  estimated_time_delivery: string | null
}

type Props = {
  cart: Cart
  deliverySettings: DeliverySettings | null
  businessCurrency: string
  action: (formData: FormData) => Promise<void>
  error?: string
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
    >
      {pending ? <><Loader2 size={15} className="animate-spin" />Placing order…</> : 'Place order'}
    </button>
  )
}

export default function CheckoutForm({
  cart,
  deliverySettings,
  businessCurrency,
  action,
  error,
}: Props) {
  // Defaults: prefer pickup if available
  const defaultMethod =
    deliverySettings?.pickup_enabled !== false ? 'pickup' : 'delivery'
  const [method, setMethod] = useState<'pickup' | 'delivery'>(defaultMethod)

  const subtotal = getSubtotal(cart)

  // Calculate delivery fee for display
  let deliveryFee = 0
  if (method === 'delivery' && deliverySettings) {
    if (
      deliverySettings.free_delivery_above != null &&
      subtotal >= deliverySettings.free_delivery_above
    ) {
      deliveryFee = 0
    } else {
      deliveryFee = deliverySettings.delivery_fee
    }
  }
  const total = subtotal + deliveryFee

  const pickupEnabled   = deliverySettings?.pickup_enabled   !== false
  const deliveryEnabled = deliverySettings?.delivery_enabled === true

  return (
    <form action={action} className="space-y-5">
      {/* Hidden cart fields */}
      <input type="hidden" name="business_id"        value={cart.businessId} />
      <input type="hidden" name="fulfillment_method" value={method} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })))}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Order summary */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Store size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cart.businessName}</span>
        </div>
        {cart.items.map((item) => (
          <div key={item.productId} className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {item.productName} × {item.quantity}
            </span>
            <span className="text-gray-900 dark:text-white tabular-nums">
              {fmtCurrency(item.unitPrice * item.quantity, businessCurrency)}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-100 dark:border-neutral-800 pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
            <span className="tabular-nums">{fmtCurrency(subtotal, businessCurrency)}</span>
          </div>
          {method === 'delivery' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Delivery fee</span>
              <span className="tabular-nums">
                {deliveryFee === 0
                  ? <span className="text-green-600 dark:text-green-400">Free</span>
                  : fmtCurrency(deliveryFee, businessCurrency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-900 dark:text-white">Total</span>
            <span className="text-gray-900 dark:text-white tabular-nums">{fmtCurrency(total, businessCurrency)}</span>
          </div>
        </div>
      </div>

      {/* Fulfillment method */}
      {(pickupEnabled || deliveryEnabled) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fulfillment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {pickupEnabled && (
              <button
                type="button"
                onClick={() => setMethod('pickup')}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  method === 'pickup'
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Pickup</div>
                {deliverySettings?.estimated_time_pickup && (
                  <div className="text-xs mt-0.5 opacity-70">{deliverySettings.estimated_time_pickup}</div>
                )}
              </button>
            )}
            {deliveryEnabled && (
              <button
                type="button"
                onClick={() => setMethod('delivery')}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  method === 'delivery'
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">
                  Delivery
                  {deliverySettings && deliverySettings.delivery_fee > 0 && (
                    <span className="ml-1 font-normal opacity-70">
                      +{fmtCurrency(deliverySettings.delivery_fee, businessCurrency)}
                    </span>
                  )}
                </div>
                {deliverySettings?.estimated_time_delivery && (
                  <div className="text-xs mt-0.5 opacity-70">{deliverySettings.estimated_time_delivery}</div>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delivery address (only when delivery selected) */}
      {method === 'delivery' && (
        <div>
          <label htmlFor="delivery_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Delivery address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
            <textarea
              id="delivery_address"
              name="delivery_address"
              rows={2}
              required
              placeholder="Street, suburb, city…"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <label htmlFor="customer_note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Note to business{' '}
          <span className="text-gray-400 dark:text-neutral-500 font-normal">(optional)</span>
        </label>
        <textarea
          id="customer_note"
          name="customer_note"
          rows={2}
          placeholder="Special instructions, allergies, etc."
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Link
          href="/app/cart"
          className="flex-1 flex items-center justify-center px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Back to cart
        </Link>
        <div className="flex-1">
          <SubmitButton />
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-neutral-500">
        Final prices are confirmed by the business at placement.
      </p>
    </form>
  )
}
