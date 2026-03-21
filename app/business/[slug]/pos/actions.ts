'use server'

import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

// ── Customer search ────────────────────────────────────────────────────────────

export type FoundCustomer = {
  userId: string
  displayName: string | null
  email: string | null
  phone: string | null
  isKnownCustomer: boolean
}

export type SearchCustomerResult =
  | { success: true; customer: FoundCustomer | null }
  | { success: false; error: string }

/**
 * Searches for a registered platform user by exact phone or email.
 * Calls the search_business_customer SECURITY DEFINER RPC which enforces:
 *   - caller is an active business member
 *   - exact match only (no fuzzy search)
 *   - returns minimal identity fields
 */
export async function searchCustomerForBusiness(
  slug: string,
  query: string
): Promise<SearchCustomerResult> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_customers')) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const trimmed = query.trim()
  if (!trimmed) {
    return { success: false, error: 'Enter a phone number or email to search' }
  }

  const isEmail = trimmed.includes('@')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('search_business_customer', {
    p_business_id: ctx.business.id,
    p_phone:       isEmail ? null : trimmed,
    p_email:       isEmail ? trimmed : null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data || data.length === 0) {
    return { success: true, customer: null }
  }

  const row = data[0]
  return {
    success: true,
    customer: {
      userId:          row.user_id,
      displayName:     row.display_name ?? null,
      email:           row.email ?? null,
      phone:           row.phone ?? null,
      isKnownCustomer: row.is_known_customer ?? false,
    },
  }
}

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
  tendered_amount?: number  // cash only
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

  for (const p of payload.payments) {
    if (p.payment_method === 'cash') {
      if (p.tendered_amount == null || isNaN(p.tendered_amount)) {
        return { success: false, error: 'Enter the cash amount received' }
      }
      if (p.tendered_amount < p.amount) {
        return {
          success: false,
          error: `Cash received is short by ${(p.amount - p.tendered_amount).toFixed(2)}`,
        }
      }
    }
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
      ...(p.payment_method === 'cash' && p.tendered_amount != null
        ? { tendered_amount: p.tendered_amount }
        : {}),
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, saleId: saleId as string }
}
