'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getCart, type Cart } from '@/lib/cart/store'
import { placeOrder } from '@/app/app/orders/actions'
import CheckoutForm from './CheckoutForm'

type DeliverySettings = {
  pickup_enabled: boolean
  delivery_enabled: boolean
  delivery_fee: number
  free_delivery_above: number | null
  estimated_time_pickup: string | null
  estimated_time_delivery: string | null
}

type Props = {
  error?: string
}

export default function CartReader({ error }: Props) {
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const c = getCart()
    if (!c || c.items.length === 0) {
      router.replace('/app/cart')
      return
    }
    setCart(c)

    const supabase = createClient()

    async function fetchSettings() {
      // Fetch business currency
      const { data: biz } = await supabase
        .from('businesses')
        .select('currency_code')
        .eq('id', c!.businessId)
        .single()

      if (biz) setCurrency(biz.currency_code)

      // Fetch delivery settings (may not exist yet)
      const { data: ds } = await supabase
        .from('business_delivery_settings')
        .select('pickup_enabled, delivery_enabled, delivery_fee, free_delivery_above, estimated_time_pickup, estimated_time_delivery')
        .eq('business_id', c!.businessId)
        .maybeSingle()

      setSettings(
        ds ?? {
          pickup_enabled: true,
          delivery_enabled: false,
          delivery_fee: 0,
          free_delivery_above: null,
          estimated_time_pickup: null,
          estimated_time_delivery: null,
        }
      )
      setLoading(false)
    }

    fetchSettings()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!cart) {
    return (
      <div className="text-center py-12">
        <ShoppingCart size={28} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
        <p className="text-sm text-gray-400 dark:text-neutral-500">Cart is empty</p>
        <Link href="/businesses" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">
          Browse stores
        </Link>
      </div>
    )
  }

  return (
    <CheckoutForm
      cart={cart}
      deliverySettings={settings}
      businessCurrency={currency}
      action={placeOrder}
      error={error}
    />
  )
}
