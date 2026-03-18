'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

export async function adjustInventory(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'adjust_inventory')) {
    redirect(`/business/${slug}/inventory?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`/business/${slug}/inventory?error=Subscription+is+not+active`)
  }

  const productId  = (formData.get('product_id')  as string | null)?.trim()
  const direction  = (formData.get('direction')    as string | null)?.trim()
  const quantityRaw = parseInt((formData.get('quantity') as string | null) ?? '', 10)
  const reason     = (formData.get('reason')       as string | null)?.trim()
  const notesExtra = (formData.get('notes')        as string | null)?.trim() || null

  const adjustPath = `/business/${slug}/inventory/adjust`

  if (!productId) {
    redirect(`${adjustPath}?error=Product+is+required`)
  }
  if (direction !== 'in' && direction !== 'out') {
    redirect(`${adjustPath}?error=Invalid+adjustment+type`)
  }
  if (!quantityRaw || quantityRaw <= 0 || !Number.isInteger(quantityRaw)) {
    redirect(`${adjustPath}?error=Quantity+must+be+a+positive+whole+number`)
  }
  if (!reason) {
    redirect(`${adjustPath}?error=Reason+is+required`)
  }

  const supabase = await createClient()

  // Verify product belongs to this business
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!product) {
    redirect(`${adjustPath}?error=Product+not+found`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  const movementType = direction === 'in' ? 'adjustment_in' : 'adjustment_out'
  const quantity     = direction === 'in' ? quantityRaw : -quantityRaw
  const notes        = notesExtra ? `${reason}: ${notesExtra}` : reason

  const { error } = await supabase.from('inventory_movements').insert({
    business_id:          ctx.business.id,
    location_id:          null,
    product_id:           productId,
    quantity,
    movement_type:        movementType,
    reference_type:       'adjustment',
    reference_id:         null,
    performed_by_user_id: user!.id,
    notes,
  })

  if (error) {
    redirect(`${adjustPath}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/business/${slug}/inventory`)
  redirect(`/business/${slug}/inventory?success=Stock+adjusted+successfully`)
}
