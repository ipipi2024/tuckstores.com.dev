'use client'

import { useState } from 'react'

const INPUT_CLASS =
  'w-full border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white dark:placeholder:text-neutral-500'

export default function CategorySelect({
  categories,
  defaultValue,
}: {
  categories: string[]
  defaultValue?: string
}) {
  const isNew = defaultValue && !categories.includes(defaultValue)
  const [selected, setSelected] = useState(isNew ? '__new__' : (defaultValue ?? ''))
  const [newName, setNewName] = useState(isNew ? defaultValue : '')

  const showNewInput = selected === '__new__'

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">— No category —</option>
        {categories.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        <option value="__new__">+ Add new category…</option>
      </select>

      {showNewInput && (
        <input
          type="text"
          placeholder="Category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          className={INPUT_CLASS}
        />
      )}

      {/* hidden field that carries the final value to the server action */}
      <input
        type="hidden"
        name="category"
        value={showNewInput ? newName : selected}
      />
    </div>
  )
}
