'use client'

import { useState } from 'react'

type Category = { id: string; name: string }

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CategoryPicker({
  categories,
  currentName = '',
}: {
  categories: Category[]
  currentName?: string
}) {
  const [mode, setMode] = useState<'select' | 'new'>(
    categories.length === 0 ? 'new' : 'select'
  )
  const [selectedName, setSelectedName] = useState(currentName)

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === '__new__') {
      setMode('new')
      setSelectedName('')
    } else {
      setSelectedName(val)
    }
  }

  function backToSelect() {
    setMode('select')
    setSelectedName('')
  }

  if (mode === 'new') {
    return (
      <div className="space-y-1.5">
        <input
          name="category_name"
          type="text"
          autoFocus
          placeholder={
            categories.length === 0
              ? 'e.g. Beverages (creates your first category)'
              : 'New category name'
          }
          className={inputCls}
        />
        {categories.length > 0 && (
          <button
            type="button"
            onClick={backToSelect}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Back to existing categories
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {/* Hidden input submits the category name — select itself has no name */}
      <input type="hidden" name="category_name" value={selectedName} />
      <select value={selectedName} onChange={handleSelectChange} className={inputCls}>
        <option value="">— No category —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
        <option value="__new__">＋ Add new category…</option>
      </select>
    </div>
  )
}
