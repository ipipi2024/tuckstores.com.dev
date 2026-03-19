'use server'

import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { dispatchNotificationToBusinessMembers } from '@/lib/notifications'

/**
 * Place a new order.
 * Cart items are passed as JSON from the client (display prices only).
 * The create_order RPC re-reads authoritative prices from the DB.
 */
export async function placeOrder(formData: FormData): Promise<void> {
  await getAuthUser() // ensure authenticated

  const businessId        = formData.get('business_id') as string
  const fulfillmentMethod = formData.get('fulfillment_method') as string
  const customerNote      = (formData.get('customer_note') as string) || null
  const deliveryAddress   = (formData.get('delivery_address') as string) || null
  const itemsJson         = formData.get('items') as string

  if (!businessId || !fulfillmentMethod || !itemsJson) {
    redirect('/app/checkout?error=' + encodeURIComponent('Missing required fields'))
  }

  let items: { product_id: string; quantity: number }[]
  try {
    const raw = JSON.parse(itemsJson) as { productId: string; quantity: number }[]
    items = raw.map((i) => ({ product_id: i.productId, quantity: i.quantity }))
  } catch {
    redirect('/app/checkout?error=' + encodeURIComponent('Invalid cart data'))
  }

  const supabase = await createClient()
  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_business_id:        businessId,
    p_fulfillment_method: fulfillmentMethod,
    p_customer_note:      customerNote,
    p_delivery_address:   deliveryAddress,
    p_items:              items,
  })

  if (error) {
    redirect('/app/checkout?error=' + encodeURIComponent(error.message))
  }

  // Notify all active business members of the new order — fire-and-forget
  dispatchNotificationToBusinessMembers(businessId, {
    type:  'order_placed',
    title: 'New order received',
    body:  'A customer just placed an order.',
    data: {
      order_id:    orderId as string,
      business_id: businessId,
      url:         `/business/{slug}/orders/${orderId}`,
    },
  }).catch(() => {})

  redirect(`/app/orders/${orderId}?placed=1`)
}

export async function cancelOrder(orderId: string): Promise<void> {
  await getAuthUser()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .in('status', ['pending', 'accepted'])
    .select('id')

  if (error) {
    redirect(`/app/orders/${orderId}?error=` + encodeURIComponent(error.message))
  }

  if (!data || data.length === 0) {
    redirect(
      `/app/orders/${orderId}?error=` +
        encodeURIComponent('This order can no longer be cancelled because preparation has already started.')
    )
  }

  redirect(`/app/orders/${orderId}?cancelled=1`)
}
