'use client'

export default function PriceSparkline({ prices, fullWidth }: { prices: number[]; fullWidth?: boolean }) {
  if (prices.length < 2) return <span className="text-xs text-gray-300 dark:text-neutral-600">—</span>

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const W = 64, H = 24, pad = 2
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (p - min) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')

  const rising = prices[prices.length - 1] > prices[0]
  const flat = prices[prices.length - 1] === prices[0]
  const color = flat ? '#9ca3af' : rising ? '#ef4444' : '#22c55e'

  if (fullWidth) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-10">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width={W} height={H} className="inline-block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
