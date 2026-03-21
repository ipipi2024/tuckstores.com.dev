import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Store, Search, X, ChevronRight } from 'lucide-react'

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
  const activeCountryName = country?.trim() ? countryName(country.trim()) : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hasFilters
              ? businesses.length > 0
                ? `${businesses.length} store${businesses.length !== 1 ? 's' : ''} found`
                : 'No stores match your search'
              : 'Discover stores and browse their products'}
          </p>
        </div>

        {/* Search + Filter */}
        <form method="get" className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none"
            />
            <input
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Search stores…"
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          {/* Country filter + submit on one row */}
          <div className="flex gap-2">
            <select
              name="country"
              defaultValue={country ?? ''}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Active filter summary */}
        {hasFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {q?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                &ldquo;{q.trim()}&rdquo;
              </span>
            )}
            {activeCountryName && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                {activeCountryName}
              </span>
            )}
            <Link
              href="/businesses"
              className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors ml-1"
            >
              <X size={12} />
              Clear
            </Link>
          </div>
        )}

        {/* Results */}
        {businesses.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-12 text-center space-y-3">
            <Store size={32} className="mx-auto text-gray-300 dark:text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {hasFilters ? 'No stores match your search' : 'No stores yet'}
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                {hasFilters
                  ? 'Try a different name or country.'
                  : 'Stores will appear here once they sign up.'}
              </p>
            </div>
            {hasFilters && (
              <Link
                href="/businesses"
                className="inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Browse all stores
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {businesses.map((biz) => {
              const location = [biz.city, biz.country_code ? countryName(biz.country_code) : null]
                .filter(Boolean)
                .join(', ')
              return (
                <Link
                  key={biz.id}
                  href={`/businesses/${biz.slug}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {/* Avatar */}
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-base font-bold text-indigo-600 dark:text-indigo-300">
                    {biz.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {biz.name}
                    </p>
                    {biz.description ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {biz.description}
                      </p>
                    ) : location ? (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{location}</p>
                    ) : null}
                    {biz.description && location && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{location}</p>
                    )}
                  </div>
                  <ChevronRight size={15} className="text-gray-300 dark:text-neutral-600 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
