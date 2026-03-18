'use server'

import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

export type SaleItem = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
}

export type SalePayment = {
  payment_method: string
  amount: number
  reference: string | null
}

export type CompleteSalePayload = {
  items: SaleItem[]
  payments: SalePayment[]
  customer_user_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  notes: string | null
}

export type CompleteSaleResult =
  | { success: true; saleId: string }
  | { success: false; error: string }

export async function completeSale(
  slug: string,
  payload: CompleteSalePayload
): Promise<CompleteSaleResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'create_sale')) {
    return { success: false, error: 'Insufficient permissions' }
  }
  if (!isSubscriptionActive(ctx)) {
    return { success: false, error: 'Subscription is not active' }
  }
  if (!payload.items.length) {
    return { success: false, error: 'Cart is empty' }
  }
  if (!payload.payments.length) {
    return { success: false, error: 'No payment provided' }
  }

  const supabase = await createClient()

  const { data: saleId, error } = await supabase.rpc('create_sale', {
    p_business_id:             ctx.business.id,
    p_location_id:             null,
    p_customer_user_id:        payload.customer_user_id,
    p_customer_name_snapshot:  payload.customer_name_snapshot,
    p_customer_phone_snapshot: payload.customer_phone_snapshot,
    p_sale_channel:            'pos',
    p_notes:                   payload.notes,
    p_items:                   payload.items.map((i) => ({
      product_id:      i.product_id,
      product_name:    i.product_name,
      quantity:        i.quantity,
      unit_price:      i.unit_price,
      discount_amount: i.discount_amount,
    })),
    p_payments: payload.payments.map((p) => ({
      payment_method: p.payment_method,
      amount:         p.amount,
      reference:      p.reference ?? null,
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, saleId: saleId as string }
}
