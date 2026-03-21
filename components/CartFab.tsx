'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { getCart, getItemCount, type Cart } from '@/lib/cart/store'

export default function CartFab() {
  const [cart, setCart] = useState<Cart | null>(null)

  useEffect(() => {
    setCart(getCart())

    function onUpdate() {
      setCart(getCart())
    }

    window.addEventListener('cart-updated', onUpdate)
    return () => window.removeEventListener('cart-updated', onUpdate)
  }, [])

  const count = getItemCount(cart)
  if (count === 0) return null

  return (
    <Link
      href="/app/cart"
      className="fixed bottom-6 right-4 z-50 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors"
    >
      <ShoppingCart size={18} />
      <span className="text-sm font-semibold">{count} in cart</span>
    </Link>
  )
}
