import { getAuthUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { placeOrder } from '@/app/app/orders/actions'
import CheckoutForm from './CheckoutForm'
import CartReader from './CartReader'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function CheckoutPage({ searchParams }: Props) {
  const { error } = await searchParams
  await getAuthUser()

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Checkout</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Review your order before placing</p>
      </div>

      {/* CartReader is a client component that reads localStorage,
          fetches delivery settings server-side via a route, and renders CheckoutForm */}
      <CartReader error={error ? decodeURIComponent(error) : undefined} />
    </div>
  )
}
