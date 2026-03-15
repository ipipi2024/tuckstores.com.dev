'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

type DailyPoint = { date: string; revenue: number; sales: number }

type Period = 'daily' | 'weekly' | 'monthly'

function groupWeekly(daily: DailyPoint[]): DailyPoint[] {
  const weeks: Record<string, DailyPoint> = {}
  for (const d of daily) {
    const dt = new Date(d.date)
    // start of week (Monday)
    const day = dt.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    const mon = new Date(dt)
    mon.setDate(dt.getDate() + diff)
    const key = mon.toISOString().slice(0, 10)
    if (!weeks[key]) weeks[key] = { date: key, revenue: 0, sales: 0 }
    weeks[key].revenue += d.revenue
    weeks[key].sales += d.sales
  }
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date))
}

function groupMonthly(daily: DailyPoint[]): DailyPoint[] {
  const months: Record<string, DailyPoint> = {}
  for (const d of daily) {
    const key = d.date.slice(0, 7)
    if (!months[key]) months[key] = { date: key, revenue: 0, sales: 0 }
    months[key].revenue += d.revenue
    months[key].sales += d.sales
  }
  return Object.values(months).sort((a, b) => a.date.localeCompare(b.date))
}

function formatLabel(date: string, period: Period) {
  if (period === 'monthly') {
    return new Date(date + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  }
  if (period === 'weekly') {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const dt = new Date(date)
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const CustomTooltip = ({ active, payload, label, period }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-neutral-900 border dark:border-neutral-700 rounded-lg px-3 py-2 text-xs shadow">
      <p className="font-medium mb-1">{formatLabel(label, period)}</p>
      <p>Revenue: <span className="font-semibold">R{Number(payload[0]?.value ?? 0).toFixed(2)}</span></p>
      <p>Sales: <span className="font-semibold">{payload[0]?.payload?.sales}</span></p>
    </div>
  )
}

export default function SalesTrendChart({ daily }: { daily: DailyPoint[] }) {
  const [period, setPeriod] = useState<Period>('daily')

  const data = useMemo(() => {
    if (period === 'weekly') return groupWeekly(daily)
    if (period === 'monthly') return groupMonthly(daily)
    return daily
  }, [daily, period])

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalSales = data.reduce((s, d) => s + d.sales, 0)

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 w-fit">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              period === p
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-gray-500 dark:text-neutral-400">Total revenue </span>
          <span className="font-semibold">R{totalRevenue.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-neutral-400">Total sales </span>
          <span className="font-semibold">{totalSales}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-neutral-800" stroke="currentColor" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatLabel(v, period)}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-gray-400 dark:fill-neutral-500"
              fill="currentColor"
            />
            <YAxis
              tickFormatter={(v) => `R${v}`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-gray-400 dark:fill-neutral-500"
              fill="currentColor"
            />
            <Tooltip content={<CustomTooltip period={period} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="revenue" radius={[3, 3, 0, 0]} className="fill-black dark:fill-white" fill="currentColor" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
