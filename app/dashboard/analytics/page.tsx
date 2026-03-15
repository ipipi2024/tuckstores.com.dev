import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SalesTrendChart from '@/components/SalesTrendChart'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // fetch last 90 days of sales
  const from = new Date()
  from.setDate(from.getDate() - 89)
  from.setHours(0, 0, 0, 0)

  const { data: sales } = await supabase
    .from('sales')
    .select('total_amount, created_at')
    .eq('user_id', user.id)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true })

  // group by date
  const byDate: Record<string, { revenue: number; sales: number }> = {}

  // pre-fill all 90 days with 0 so gaps show in chart
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    byDate[key] = { revenue: 0, sales: 0 }
  }

  for (const sale of sales ?? []) {
    const key = sale.created_at.slice(0, 10)
    if (!byDate[key]) byDate[key] = { revenue: 0, sales: 0 }
    byDate[key].revenue += Number(sale.total_amount ?? 0)
    byDate[key].sales += 1
  }

  const daily = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">Last 90 days</p>
      </div>

      <div className="border dark:border-neutral-700 rounded-lg p-5 bg-white dark:bg-neutral-900 space-y-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Revenue trend</h2>
        <SalesTrendChart daily={daily} />
      </div>
    </div>
  )
}
