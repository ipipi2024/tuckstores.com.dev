'use client'

import { useState } from 'react'

type Supplier = { id: string; name: string }

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function SupplierPicker({ suppliers }: { suppliers: Supplier[] }) {
  const [mode, setMode] = useState<'select' | 'new'>('select')

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__new__') {
      setMode('new')
    }
  }

  function backToSelect() {
    setMode('select')
  }

  if (mode === 'new') {
    return (
      <div className="space-y-1.5">
        <input type="hidden" name="supplier_id" value="" />
        <input
          name="new_supplier_name"
          type="text"
          autoFocus
          placeholder="New supplier name"
          className={inputCls}
        />
        <button
          type="button"
          onClick={backToSelect}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back to existing suppliers
        </button>
      </div>
    )
  }

  return (
    <div>
      <input type="hidden" name="new_supplier_name" value="" />
      <select name="supplier_id" onChange={handleSelectChange} className={inputCls}>
        <option value="">— None —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value="__new__">＋ Add new supplier…</option>
      </select>
    </div>
  )
}
