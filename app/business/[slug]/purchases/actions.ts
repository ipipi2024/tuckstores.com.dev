'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

function purchasesPath(slug: string) {
  return `/business/${slug}/purchases`
}

export async function createPurchase(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'create_purchase')) {
    redirect(`${purchasesPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${purchasesPath(slug)}?error=Subscription+is+not+active`)
  }

  // Parse items from form
  const itemsJson = formData.get('items') as string | null
  let items: Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }>
  try {
    items = itemsJson ? JSON.parse(itemsJson) : []
  } catch {
    redirect(`/business/${slug}/purchases/new?error=Invalid+items+data`)
  }

  if (!items.length) {
    redirect(`/business/${slug}/purchases/new?error=At+least+one+item+is+required`)
  }

  const purchaseDateRaw = formData.get('purchase_date') as string | null
  const purchaseDate = purchaseDateRaw?.trim() || new Date().toISOString().split('T')[0]

  const supplierId = (formData.get('supplier_id') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  const supabase = await createClient()

  const { data: purchaseId, error } = await supabase.rpc('create_purchase', {
    p_business_id: ctx.business.id,
    p_location_id: null,
    p_supplier_id: supplierId,
    p_purchase_date: purchaseDate,
    p_notes: notes,
    p_items: items,
  })

  if (error) {
    redirect(`/business/${slug}/purchases/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(purchasesPath(slug))
  revalidatePath(`/business/${slug}/inventory`)
  redirect(`${purchasesPath(slug)}/${purchaseId}`)
}
