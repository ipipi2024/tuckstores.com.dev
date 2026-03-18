'use server'

import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
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
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_orders')) {
    redirect(`/business/${slug}/orders/${orderId}?error=` + encodeURIComponent('Insufficient permissions'))
  }

  const newStatus = formData.get('status') as string
  if (!newStatus) {
    redirect(`/business/${slug}/orders/${orderId}?error=` + encodeURIComponent('Missing status'))
  }

  const supabase = await createClient()

  // Fetch current order to validate transition
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status')
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

  redirect(`/business/${slug}/orders/${orderId}?success=1`)
}
