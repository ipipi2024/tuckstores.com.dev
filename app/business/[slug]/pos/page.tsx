import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import POSClient from './POSClient'
import { completeSale } from './actions'

type Props = { params: Promise<{ slug: string }> }

export default async function POSPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'create_sale')) {
    redirect(`/business/${slug}/dashboard`)
  }

  if (!isSubscriptionActive(ctx)) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 max-w-lg">
        <AlertCircle size={15} className="flex-shrink-0" />
        Subscription is not active. POS is unavailable.
      </div>
    )
  }

  const supabase = await createClient()

  // Fetch active products with their current stock and measurement info
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, sku, selling_price, measurement_type, base_unit,
      product_stock ( stock_quantity ),
      product_images ( url, position )
    `)
    .eq('business_id', ctx.business.id)
    .eq('is_active', true)
    .order('name')

  const productList = (products ?? []).map((p) => {
    const stockRows = Array.isArray(p.product_stock) ? p.product_stock : (p.product_stock ? [p.product_stock] : [])
    const stock = stockRows.reduce((sum: number, r: { stock_quantity: number | null }) => sum + (r.stock_quantity ?? 0), 0)
    const imgs = Array.isArray(p.product_images) ? p.product_images : (p.product_images ? [p.product_images] : [])
    const primaryImg = imgs.sort((a: { position: number }, b: { position: number }) => a.position - b.position)[0]
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      selling_price: p.selling_price ?? 0,
      stock,
      measurement_type: p.measurement_type ?? 'unit',
      base_unit: p.base_unit ?? 'unit',
      image_url: primaryImg?.url ?? null,
    }
  })

  // Fetch known customers for the name-search combobox in the POS
  // Includes both registered users and previously recorded walk-ins
  const { data: customerRows } = await supabase
    .from('business_customers')
    .select('id, user_id, display_name_snapshot, email_snapshot, phone_snapshot')
    .eq('business_id', ctx.business.id)
    .order('display_name_snapshot', { ascending: true })
    .limit(500)

  const customerList = (customerRows ?? []).map((c) => ({
    id: c.id as string,
    userId: c.user_id as string | null,
    displayName: c.display_name_snapshot as string | null,
    email: c.email_snapshot as string | null,
    phone: c.phone_snapshot as string | null,
  }))

  const action = completeSale.bind(null, slug)

  return (
    <POSClient
      products={productList}
      currencyCode={ctx.business.currency_code}
      completeSale={action}
      customers={customerList}
      slug={slug}
    />
  )
}
