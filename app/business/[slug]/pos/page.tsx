import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import POSClient from './POSClient'
import { completeSale, searchCustomerForBusiness } from './actions'

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

  // Fetch active products with their current stock
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, sku, selling_price,
      product_stock ( stock_quantity )
    `)
    .eq('business_id', ctx.business.id)
    .eq('is_active', true)
    .order('name')

  // Normalise stock into a flat list
  const productList = (products ?? []).map((p) => {
    const stockRows = Array.isArray(p.product_stock) ? p.product_stock : (p.product_stock ? [p.product_stock] : [])
    const stock = stockRows.reduce((sum: number, r: { stock_quantity: number | null }) => sum + (r.stock_quantity ?? 0), 0)
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      selling_price: p.selling_price ?? 0,
      stock,
    }
  })

  const action = completeSale.bind(null, slug)
  const searchAction = searchCustomerForBusiness.bind(null, slug)

  return (
    <POSClient
      products={productList}
      currencyCode={ctx.business.currency_code}
      completeSale={action}
      searchCustomer={searchAction}
      slug={slug}
    />
  )
}
