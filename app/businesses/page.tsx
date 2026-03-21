import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Store, Search, X, MapPin } from 'lucide-react'

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
    .select('id, name, slug, description, catchline, currency_code, country_code, city, logo_url, cover_image_url')
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
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Explore Stores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hasFilters
              ? businesses.length > 0
                ? `${businesses.length} store${businesses.length !== 1 ? 's' : ''} found`
                : 'No stores match your search'
              : 'Discover local stores and browse their products'}
          </p>
        </div>

        {/* Search + Filter */}
        <form method="get" className="flex gap-2 flex-wrap sm:flex-nowrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none"
            />
            <input
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Search stores…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          {/* Country filter */}
          <select
            name="country"
            defaultValue={country ?? ''}
            className="shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          <button
            type="submit"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Active filter chips */}
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
              className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
            >
              <X size={12} />
              Clear filters
            </Link>
          </div>
        )}

        {/* Results */}
        {businesses.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mx-auto">
              <Store size={28} className="text-gray-300 dark:text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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
                className="inline-block text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Browse all stores
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((biz) => {
              const location = [biz.city, biz.country_code ? countryName(biz.country_code) : null]
                .filter(Boolean)
                .join(', ')
              const blurb = biz.catchline || biz.description || null

              return (
                <Link
                  key={biz.id}
                  href={`/businesses/${biz.slug}`}
                  className="group bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                >
                  {/* Cover photo */}
                  <div className="relative w-full aspect-[16/7] bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/40 dark:to-indigo-800/30 overflow-hidden">
                    {biz.cover_image_url ? (
                      <img
                        src={biz.cover_image_url}
                        alt={`${biz.name} cover`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store size={32} className="text-indigo-300 dark:text-indigo-600" />
                      </div>
                    )}

                    {/* Logo — overlaps bottom-left of cover */}
                    <div className="absolute -bottom-5 left-4">
                      {biz.logo_url ? (
                        <img
                          src={biz.logo_url}
                          alt={`${biz.name} logo`}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-white dark:ring-neutral-900 shadow-md bg-white dark:bg-neutral-900"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl ring-2 ring-white dark:ring-neutral-900 shadow-md bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                          {biz.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col flex-1 px-4 pt-8 pb-4 gap-1.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug truncate">
                      {biz.name}
                    </p>

                    {blurb && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {blurb}
                      </p>
                    )}

                    {location && (
                      <div className="flex items-center gap-1 mt-auto pt-2">
                        <MapPin size={11} className="text-gray-400 dark:text-neutral-500 shrink-0" />
                        <span className="text-xs text-gray-400 dark:text-neutral-500 truncate">
                          {location}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
