import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitPurchase, quickAddSupplier } from '../actions'
import NewPurchaseForm from './NewPurchaseForm'

export default async function NewPurchasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: productsRaw }, { data: stockData }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('id, name').order('name'),
    supabase.from('product_stock').select('product_id, stock_quantity'),
    supabase.from('suppliers').select('id, name').order('name'),
  ])

  const stockMap = new Map(
    (stockData ?? []).map((s) => [s.product_id, Number(s.stock_quantity)])
  )

  const products = (productsRaw ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    stock: stockMap.get(p.id as string) ?? null,
  }))

  return (
    <NewPurchaseForm
      products={products}
      suppliers={suppliers ?? []}
      onSubmit={submitPurchase}
      onQuickAddSupplier={quickAddSupplier}
    />
  )
}
