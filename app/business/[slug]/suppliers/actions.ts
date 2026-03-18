'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'

function suppliersPath(slug: string) {
  return `/business/${slug}/suppliers`
}

export async function addSupplier(slug: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_suppliers')) {
    redirect(`${suppliersPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${suppliersPath(slug)}?error=Subscription+is+not+active`)
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect(`/business/${slug}/suppliers/new?error=Supplier+name+is+required`)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').insert({
    business_id: ctx.business.id,
    name,
    contact_name: (formData.get('contact_name') as string | null)?.trim() || null,
    email: (formData.get('email') as string | null)?.trim() || null,
    phone: (formData.get('phone') as string | null)?.trim() || null,
    address: (formData.get('address') as string | null)?.trim() || null,
    notes: (formData.get('notes') as string | null)?.trim() || null,
  })

  if (error) {
    redirect(`/business/${slug}/suppliers/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(suppliersPath(slug))
  redirect(suppliersPath(slug))
}

export async function updateSupplier(slug: string, id: string, formData: FormData) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_suppliers')) {
    redirect(`${suppliersPath(slug)}?error=Insufficient+permissions`)
  }
  if (!isSubscriptionActive(ctx)) {
    redirect(`${suppliersPath(slug)}?error=Subscription+is+not+active`)
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect(`/business/${slug}/suppliers/${id}?error=Supplier+name+is+required`)
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!existing) {
    redirect(`${suppliersPath(slug)}?error=Supplier+not+found`)
  }

  const { error } = await supabase
    .from('suppliers')
    .update({
      name,
      contact_name: (formData.get('contact_name') as string | null)?.trim() || null,
      email: (formData.get('email') as string | null)?.trim() || null,
      phone: (formData.get('phone') as string | null)?.trim() || null,
      address: (formData.get('address') as string | null)?.trim() || null,
      notes: (formData.get('notes') as string | null)?.trim() || null,
    })
    .eq('id', id)
    .eq('business_id', ctx.business.id)

  if (error) {
    redirect(`/business/${slug}/suppliers/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(suppliersPath(slug))
  redirect(suppliersPath(slug))
}

export async function deleteSupplier(slug: string, id: string) {
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_suppliers')) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('business_id', ctx.business.id)

  if (error) return { error: error.message }

  revalidatePath(suppliersPath(slug))
  return { success: true }
}
