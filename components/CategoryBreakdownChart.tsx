'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Category = { name: string; revenue: number; quantity: number }
type SortBy = 'revenue' | 'quantity'

const COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db',
  '#1f2937', '#4b5563', '#111827', '#e5e7eb', '#f3f4f6',
]

const CustomTooltip = ({ active, payload, sortBy }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-neutral-900 border dark:border-neutral-700 rounded-lg px-3 py-2 text-xs shadow">
      <p className="font-medium mb-1">{d.name}</p>
      <p>Revenue: <span className="font-semibold">R{d.revenue.toFixed(2)}</span></p>
      <p>Units sold: <span className="font-semibold">{d.quantity}</span></p>
      <p>Share: <span className="font-semibold">{payload[0].payload.pct}%</span></p>
    </div>
  )
}

export default function CategoryBreakdownChart({ categories }: { categories: Category[] }) {
  const [sortBy, setSortBy] = useState<SortBy>('revenue')

  const total = categories.reduce((s, c) => s + c[sortBy], 0)
  const data = [...categories]
    .sort((a, b) => b[sortBy] - a[sortBy])
    .map((c) => ({
      ...c,
      value: c[sortBy],
      pct: total > 0 ? ((c[sortBy] / total) * 100).toFixed(1) : '0',
    }))

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 w-fit">
        {(['revenue', 'quantity'] as SortBy[]).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              sortBy === s
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            By {s}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-center">
        {/* Pie chart */}
        <div className="h-52 w-full sm:w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                strokeWidth={2}
                stroke="transparent"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip sortBy={sortBy} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend table */}
        <div className="flex-1 w-full space-y-2">
          {data.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-sm flex-1 truncate">{c.name}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums">{c.pct}%</span>
              <span className="text-sm font-semibold tabular-nums">
                {sortBy === 'revenue' ? `R${c.revenue.toFixed(2)}` : `${c.quantity}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
