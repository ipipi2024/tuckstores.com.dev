'use client'

import { useState } from 'react'

type Props = {
  currencyCode: string
  defaultMeasurementType?: string
  defaultSellingPrice?: number | null
  defaultCostPrice?: number | null
}

const MEASUREMENT_OPTIONS = [
  { value: 'unit',   label: 'Unit (each)' },
  { value: 'weight', label: 'Weight (kg)'  },
  { value: 'volume', label: 'Volume (L)'   },
] as const

const BASE_UNIT: Record<string, string> = {
  unit:   'unit',
  weight: 'kg',
  volume: 'L',
}

export default function MeasurementPicker({
  currencyCode,
  defaultMeasurementType = 'unit',
  defaultSellingPrice,
  defaultCostPrice,
}: Props) {
  const [measurementType, setMeasurementType] = useState(defaultMeasurementType)
  const baseUnit = BASE_UNIT[measurementType] ?? 'unit'
  const perLabel = measurementType !== 'unit' ? ` per ${baseUnit}` : ''

  return (
    <>
      {/* hidden base_unit — derived from measurementType, server action reads both */}
      <input type="hidden" name="base_unit" value={baseUnit} />

      <div>
        <label className={labelCls}>Measurement type</label>
        <select
          name="measurement_type"
          value={measurementType}
          onChange={(e) => setMeasurementType(e.target.value)}
          className={inputCls}
        >
          {MEASUREMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Selling price{perLabel} ({currencyCode})
          </label>
          <input
            name="selling_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultSellingPrice ?? ''}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Cost price{perLabel} ({currencyCode})
          </label>
          <input
            name="cost_price_default"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultCostPrice ?? ''}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
      </div>
    </>
  )
}

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
