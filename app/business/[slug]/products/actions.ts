'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function productsPath(slug: string) {
  return `/business/${slug}/products`
}

function parseDecimal(val: FormDataEntryValue | null): number | null {
  if (!val || String(val).trim() === '') return null
  const n = parseFloat(String(val))
  return isNaN(n) ? null : Math.round(n * 100) / 100
}

/**
 * Resolves a category by name for this business.
 * Creates it if it doesn't exist. Returns the category id.
 * Returns null if categoryName is empty.
 */
async function resolveCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  categoryName: string | null
): Promise<string | null> {
  const name = categoryName?.trim()
  if (!name) return null

  const { data: existing } = await supabase
    .from('product_categories')
    .select('id')
    .eq('business_id', businessId)
    .ilike('name', name)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('product_categories')
    .insert({ business_id: businessId, name })
    .select('id')
    .single()

  return created?.id ?? null
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addProduct(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    redirect(`${productsPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${productsPath(slug)}?error=Subscription+is+not+active`)
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect(`/business/${slug}/products/new?error=Product+name+is+required`)
  }

  const supabase = await createClient()
  const categoryId = await resolveCategory(
    supabase,
    ctx.business.id,
    formData.get('category_name') as string | null
  )

  const { error } = await supabase.from('products').insert({
    business_id: ctx.business.id,
    name,
    description: (formData.get('description') as string | null)?.trim() || null,
    sku: (formData.get('sku') as string | null)?.trim() || null,
    barcode: (formData.get('barcode') as string | null)?.trim() || null,
    selling_price: parseDecimal(formData.get('selling_price')),
    cost_price_default: parseDecimal(formData.get('cost_price_default')),
    category_id: categoryId,
    is_active: formData.get('is_active') !== 'false',
  })

  if (error) {
    redirect(`/business/${slug}/products/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(productsPath(slug))
  redirect(productsPath(slug))
}

export async function updateProduct(slug: string, id: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    redirect(`${productsPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${productsPath(slug)}?error=Subscription+is+not+active`)
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect(`/business/${slug}/products/${id}?error=Product+name+is+required`)
  }

  const supabase = await createClient()

  // Ensure the product belongs to this business before updating
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!existing) {
    redirect(`${productsPath(slug)}?error=Product+not+found`)
  }

  const categoryId = await resolveCategory(
    supabase,
    ctx.business.id,
    formData.get('category_name') as string | null
  )

  const { error } = await supabase
    .from('products')
    .update({
      name,
      description: (formData.get('description') as string | null)?.trim() || null,
      sku: (formData.get('sku') as string | null)?.trim() || null,
      barcode: (formData.get('barcode') as string | null)?.trim() || null,
      selling_price: parseDecimal(formData.get('selling_price')),
      cost_price_default: parseDecimal(formData.get('cost_price_default')),
      category_id: categoryId,
      is_active: formData.get('is_active') === 'true',
    })
    .eq('id', id)
    .eq('business_id', ctx.business.id)

  if (error) {
    redirect(`/business/${slug}/products/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(productsPath(slug))
  redirect(productsPath(slug))
}

export async function deleteProduct(slug: string, id: string) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('business_id', ctx.business.id)

  if (error) return { error: error.message }

  revalidatePath(productsPath(slug))
  return { success: true }
}
