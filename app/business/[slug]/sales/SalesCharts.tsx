'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'

export type DailyData = { date: string; revenue: number }
export type ChannelData = { channel: string; count: number; revenue: number }

type Props = {
  dailyData: DailyData[]
  channelData: ChannelData[]
  currency: string
}

const CHANNEL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899']

function fmtCurrency(amount: number, currency: string, compact = false) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
    minimumFractionDigits: 0,
  }).format(amount)
}

function fmtDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const tooltipStyle = {
  backgroundColor: '#1c1c1e',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e5e7eb',
}

export function SalesCharts({ dailyData, channelData, currency }: Props) {
  const hasRevenue = dailyData.some((d) => d.revenue > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Revenue trend */}
      <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Revenue — last 30 days</p>
        {!hasRevenue ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
            No revenue data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.12)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tickFormatter={(v) => fmtCurrency(v, currency, true)}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [fmtCurrency(value, currency), 'Revenue']}
                labelFormatter={fmtDay}
                contentStyle={tooltipStyle}
                cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Channel distribution */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Sales by channel</p>
        {channelData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={channelData}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtCurrency(v, currency, true)}
              />
              <YAxis
                type="category"
                dataKey="channel"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                formatter={(value: number) => [fmtCurrency(value, currency), 'Revenue']}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {channelData.map((_, i) => (
                  <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Legend */}
        <div className="mt-3 space-y-1.5">
          {channelData.map((d, i) => (
            <div key={d.channel} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                />
                <span className="text-gray-500 dark:text-gray-400">{d.channel}</span>
              </div>
              <span className="text-gray-700 dark:text-gray-300 tabular-nums font-medium">
                {d.count} sale{d.count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
