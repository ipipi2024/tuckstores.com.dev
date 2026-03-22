'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

export type TrendPoint   = { month: string; count: number }
export type SpenderPoint = { name: string; revenue: number; isWalkin: boolean }

type Props = {
  trendData:       TrendPoint[]
  topSpenders:     SpenderPoint[]
  currency:        string
  registeredCount: number
  walkinCount:     number
}

function fmtMonth(key: string) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(undefined, {
    month: 'short',
    year:  '2-digit',
  })
}

function fmtCompact(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style:              'currency',
    currency,
    notation:           'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

function fmtFull(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style:              'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

const tooltipStyle = {
  backgroundColor: '#1c1c1e',
  border:          '1px solid rgba(255,255,255,0.08)',
  borderRadius:    8,
  fontSize:        12,
  color:           '#e5e7eb',
}

export function CustomersCharts({
  trendData,
  topSpenders,
  currency,
  registeredCount,
  walkinCount,
}: Props) {
  const total         = registeredCount + walkinCount
  const registeredPct = total > 0 ? (registeredCount / total) * 100 : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* New customers trend + segment split */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          New customers — last 6 months
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.12)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              formatter={(value) => [value, 'New customers']}
              labelFormatter={(label) => fmtMonth(String(label))}
              contentStyle={tooltipStyle}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>

        {/* Registered vs Walk-in split */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-500 dark:text-gray-400">Registered vs Walk-in</span>
            <span className="text-gray-700 dark:text-gray-300 tabular-nums font-medium">{total} total</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${registeredPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              <span className="text-gray-500 dark:text-gray-400">Registered</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium tabular-nums">{registeredCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-gray-500 dark:text-gray-400">Walk-in</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium tabular-nums">{walkinCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top spenders */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Top customers by spend
        </p>
        {topSpenders.length === 0 ? (
          <div className="h-[230px] flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
            No spend data yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                data={topSpenders}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtCompact(v, currency)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tickFormatter={(v: string) => v.length > 13 ? v.slice(0, 13) + '…' : v}
                />
                <Tooltip
                  formatter={(value) => [fmtFull(Number(value), currency), 'Total spent']}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {topSpenders.map((d, i) => (
                    <Cell key={i} fill={d.isWalkin ? '#f59e0b' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                <span className="text-gray-400 dark:text-neutral-500">Registered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span className="text-gray-400 dark:text-neutral-500">Walk-in</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
