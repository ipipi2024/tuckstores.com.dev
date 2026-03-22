'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, Truck, Mail, Phone, User } from 'lucide-react'

export type SupplierEntry = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
}

type SortKey = 'name_asc' | 'name_desc'

type Props = {
  suppliers: SupplierEntry[]
  slug: string
  canManage: boolean
}

export default function SuppliersClient({ suppliers, slug, canManage }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name_asc')

  const filtered = useMemo(() => {
    let result = suppliers

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.contact_name?.toLowerCase().includes(q) ?? false) ||
          (s.email?.toLowerCase().includes(q) ?? false)
      )
    }

    return [...result].sort((a, b) =>
      sort === 'name_asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    )
  }, [suppliers, search, sort])

  if (suppliers.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Truck size={22} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No suppliers yet</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
          Add suppliers to link them to purchases and keep contact details in one place.
        </p>
        {canManage && (
          <Link
            href={`/business/${slug}/suppliers/new`}
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Add first supplier
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact, or email…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="py-2 pl-3 pr-7 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="name_asc">Name: A → Z</option>
          <option value="name_desc">Name: Z → A</option>
        </select>

        <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto whitespace-nowrap">
          {filtered.length === suppliers.length
            ? `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${suppliers.length}`}
        </span>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No suppliers match your search.</p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden sm:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-left bg-gray-50/60 dark:bg-neutral-800/40">
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Name</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Contact</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Email</th>
                  <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">Phone</th>
                  {canManage && <th className="px-4 py-2.5 w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors group">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {s.contact_name ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="hover:underline text-indigo-600 dark:text-indigo-400">
                          {s.email}
                        </a>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {s.phone ?? <span className="text-gray-300 dark:text-neutral-600">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/business/${slug}/suppliers/${s.id}`}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile card list */}
      {filtered.length > 0 && (
        <div className="sm:hidden space-y-2">
          {filtered.map((s) => {
            const content = (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                  {s.contact_name && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      <User size={10} className="flex-shrink-0" />
                      {s.contact_name}
                    </p>
                  )}
                  {s.email && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
                      <Mail size={10} className="flex-shrink-0" />
                      {s.email}
                    </p>
                  )}
                  {s.phone && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      <Phone size={10} className="flex-shrink-0" />
                      {s.phone}
                    </p>
                  )}
                </div>
                {canManage && (
                  <ChevronRight size={14} className="text-gray-300 dark:text-neutral-600 flex-shrink-0" />
                )}
              </>
            )

            if (canManage) {
              return (
                <Link
                  key={s.id}
                  href={`/business/${slug}/suppliers/${s.id}`}
                  className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div key={s.id} className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
