'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCart, getItemCount } from '@/lib/cart/store'

export default function HeaderCartIcon() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    function sync() {
      setCount(getItemCount(getCart()))
    }
    sync()
    window.addEventListener('cart-updated', sync)
    return () => window.removeEventListener('cart-updated', sync)
  }, [])

  return (
    <Link
      href="/app/cart"
      className="relative p-1.5 text-gray-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
    >
      <ShoppingCart size={18} strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
