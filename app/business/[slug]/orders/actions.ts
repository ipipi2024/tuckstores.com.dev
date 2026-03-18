'use server'

import { getBusinessContext } from '@/lib/auth/get-business-context'
import { getAuthUser } from '@/lib/auth/get-user'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// Valid status transitions for business staff
const TRANSITIONS: Record<string, string[]> = {
  pending:          ['accepted', 'rejected'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['ready'],
  ready:            ['out_for_delivery', 'completed'],
  out_for_delivery: ['completed'],
  // Terminal states — no further transitions
  rejected:         [],
  completed:        [],
  cancelled:        [],
}

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  formData: FormData
): Promise<void> {
  const [ctx, user] = await Promise.all([getBusinessContext(slug), getAuthUser()])

  if (!canPerform(ctx.membership.role, 'manage_orders')) {
    redirect(`/business/${slug}/orders/${orderId}?error=` + encodeURIComponent('Insufficient permissions'))
  }

  const newStatus = formData.get('status') as string
  if (!newStatus) {
    redirect(`/business/${slug}/orders/${orderId}?error=` + encodeURIComponent('Missing status'))
  }

  const supabase = await createClient()

  // Fetch current order + items (needed to create a sale on completion)
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select(`
      status, order_number, customer_user_id, total_amount,
      order_items ( product_id, product_name_snapshot, unit_price_snapshot, quantity )
    `)
    .eq('id', orderId)
    .eq('business_id', ctx.business.id)
    .single()

  if (fetchError || !order) {
    redirect(`/business/${slug}/orders?error=` + encodeURIComponent('Order not found'))
  }

  const allowed = TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    redirect(
      `/business/${slug}/orders/${orderId}?error=` +
      encodeURIComponent(`Cannot move from "${order.status}" to "${newStatus}"`)
    )
  }

  // Build timestamp fields
  const timestampFields: Record<string, string> = {}
  const now = new Date().toISOString()
  if (newStatus === 'accepted')         timestampFields.accepted_at  = now
  if (newStatus === 'rejected')         timestampFields.rejected_at  = now
  if (newStatus === 'completed')        timestampFields.completed_at = now
  if (newStatus === 'cancelled')        timestampFields.cancelled_at = now

  const businessNote = (formData.get('business_note') as string) || undefined

  const { error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      ...(businessNote !== undefined ? { business_note: businessNote } : {}),
      ...timestampFields,
    })
    .eq('id', orderId)
    .eq('business_id', ctx.business.id)

  if (error) {
    redirect(
      `/business/${slug}/orders/${orderId}?error=` + encodeURIComponent(error.message)
    )
  }

  // When completing an order, create a corresponding sale record.
  // We use the admin client + direct inserts (bypassing stock checks) because:
  //  - The business has already committed to fulfilling the order.
  //  - create_sale RPC would block if inventory hasn't been tracked.
  //  - We still write inventory_movements so stock is decremented.
  if (newStatus === 'completed') {
    const admin = createAdminClient()
    const items = order.order_items ?? []

    const subtotal = items.reduce(
      (sum, i) => sum + i.unit_price_snapshot * i.quantity,
      0
    )

    // Insert sale header
    const { data: sale } = await admin
      .from('sales')
      .insert({
        business_id:               ctx.business.id,
        location_id:               null,
        customer_user_id:          order.customer_user_id,
        customer_name_snapshot:    null,
        customer_phone_snapshot:   null,
        sale_channel:              'online',
        status:                    'completed',
        subtotal_amount:           subtotal,
        discount_amount:           0,
        tax_amount:                0,
        total_amount:              order.total_amount,
        notes:                     `Order ${order.order_number}`,
        recorded_by_user_id:       user.id,
      })
      .select('id')
      .single()

    if (sale) {
      // Insert sale items + inventory movements (skip items where product was deleted)
      for (const item of items) {
        if (!item.product_id) continue

        await admin.from('sale_items').insert({
          sale_id:               sale.id,
          product_id:            item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          unit_price:            item.unit_price_snapshot,
          quantity:              item.quantity,
          discount_amount:       0,
        })

        await admin.from('inventory_movements').insert({
          business_id:         ctx.business.id,
          product_id:          item.product_id,
          location_id:         null,
          movement_type:       'sale',
          quantity:            -item.quantity,
          reference_id:        sale.id,
          reference_type:      'sale',
          performed_by_user_id: user.id,
          notes:               `Order ${order.order_number}`,
        })
      }

      // Insert payment record
      await admin.from('sale_payments').insert({
        sale_id:        sale.id,
        payment_method: 'online',
        amount:         order.total_amount,
        reference:      order.order_number,
      })
    }

    // Update business_customers counts for this customer
    if (order.customer_user_id) {
      await admin.rpc('upsert_business_customer', {
        p_business_id:                  ctx.business.id,
        p_user_id:                      order.customer_user_id,
        p_order_increment:              0,
        p_completed_order_increment:    1,
        p_completed_sale_increment:     1,
      })
    }
  }

  redirect(`/business/${slug}/orders/${orderId}?success=1`)
}
