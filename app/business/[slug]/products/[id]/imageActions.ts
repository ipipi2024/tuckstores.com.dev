'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

const MAX_IMAGES = 5

function productsPath(slug: string) {
  return `/business/${slug}/products`
}

export async function addProductImage(
  slug: string,
  productId: string,
  url: string,
  storagePath: string
): Promise<{ error?: string }> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  // Verify the product belongs to this business
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!product) return { error: 'Product not found' }

  // Enforce max 5 images
  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)

  if ((count ?? 0) >= MAX_IMAGES) {
    return { error: `Maximum ${MAX_IMAGES} images per product` }
  }

  // Position = current count (append at end)
  const { error } = await supabase.from('product_images').insert({
    product_id:   productId,
    url,
    storage_path: storagePath,
    position:     count ?? 0,
  })

  if (error) return { error: error.message }

  revalidatePath(`${productsPath(slug)}/${productId}`)
  revalidatePath(productsPath(slug))
  return {}
}

export async function removeProductImage(
  slug: string,
  imageId: string,
  storagePath: string
): Promise<{ error?: string }> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  // Verify the image belongs to a product of this business before deleting
  const { data: img } = await supabase
    .from('product_images')
    .select('id, product_id, products ( business_id )')
    .eq('id', imageId)
    .maybeSingle()

  const rawProducts = img?.products
  const imgBusiness = Array.isArray(rawProducts)
    ? (rawProducts as { business_id: string }[])[0]?.business_id
    : (rawProducts as unknown as { business_id: string } | null)?.business_id

  if (!img || imgBusiness !== ctx.business.id) {
    return { error: 'Image not found' }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId)

  if (dbError) return { error: dbError.message }

  // Delete from storage (non-critical — use admin client to bypass RLS)
  const admin = createAdminClient()
  await admin.storage.from('product-images').remove([storagePath])

  // Re-normalise positions for remaining images
  const { data: remaining } = await supabase
    .from('product_images')
    .select('id')
    .eq('product_id', img.product_id)
    .order('position', { ascending: true })

  if (remaining && remaining.length > 0) {
    await Promise.all(
      remaining.map((r, i) =>
        supabase
          .from('product_images')
          .update({ position: i })
          .eq('id', r.id)
      )
    )
  }

  revalidatePath(`${productsPath(slug)}/${img.product_id}`)
  revalidatePath(productsPath(slug))
  return {}
}

export async function reorderProductImages(
  slug: string,
  productId: string,
  orderedIds: string[]
): Promise<{ error?: string }> {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_products')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from('product_images')
        .update({ position: i })
        .eq('id', id)
        .eq('product_id', productId)
    )
  )

  revalidatePath(`${productsPath(slug)}/${productId}`)
  return {}
}
