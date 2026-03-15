import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import POSScreen from './POSScreen'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: productsRaw, error: productsError }, { data: stockData }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, selling_price')
      .order('name'),
    supabase
      .from('product_stock')
      .select('product_id, stock_quantity'),
  ])

  // If selling_price column doesn't exist yet (migration not applied), fall back
  // to a query without it so products still show.
  const fallbackRows = productsError
    ? (await supabase.from('products').select('id, name').order('name')).data?.map(
        (p) => ({ ...p, selling_price: null as null })
      ) ?? []
    : null

  const rows = fallbackRows ?? productsRaw ?? []

  const stockMap = new Map(
    (stockData ?? []).map((s) => [s.product_id, Number(s.stock_quantity)])
  )

  const products = rows.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    selling_price: p.selling_price != null ? Number(p.selling_price) : null,
    stock: stockMap.get(p.id as string) ?? null,
  }))

  return <POSScreen products={products} />
}
