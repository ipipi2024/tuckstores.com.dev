'use client'

import { useEffect } from 'react'
import { clearCart } from '@/lib/cart/store'

/** Clears the localStorage cart on successful order placement. */
export default function CartClearer() {
  useEffect(() => {
    clearCart()
  }, [])
  return null
}
