import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Store, Search } from 'lucide-react'

const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'ZW', name: 'Zimbabwe' },
]

const countryName = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code

type Props = { searchParams: Promise<{ q?: string; country?: string }> }

export default async function BusinessesPage({ searchParams }: Props) {
  const { q, country } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('businesses')
    .select('id, name, slug, description, currency_code, country_code, city')
    .order('name', { ascending: true })
    .limit(50) // TODO: add cursor pagination when count exceeds 50

  if (q?.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  if (country?.trim()) {
    query = query.eq('country_code', country.trim())
  }

  const { data } = await query
  const businesses = data ?? []

  const hasFilters = !!(q?.trim() || country?.trim())

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Businesses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse stores and shops
          </p>
        </div>

        {/* Search + Filter */}
        <form method="get" className="space-y-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none"
            />
            <input
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Search businesses…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            name="country"
            defaultValue={country ?? ''}
            onChange={undefined}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        {/* Results */}
        {businesses.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
            <Store size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasFilters ? 'No businesses match your search.' : 'No businesses yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {businesses.map((biz) => (
              <Link
                key={biz.id}
                href={`/businesses/${biz.slug}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300">
                  {biz.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{biz.name}</p>
                  {biz.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{biz.description}</p>
                  )}
                </div>
                {biz.country_code && (
                  <span className="shrink-0 text-xs text-gray-400 dark:text-neutral-500 text-right">
                    {biz.city ? `${biz.city}, ` : ''}{countryName(biz.country_code)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
