import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Phone, Mail, Tag } from 'lucide-react'
import AddToCartButton from '@/components/AddToCartButton'
import CartFab from '@/components/CartFab'

type Props = { params: Promise<{ slug: string }> }

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Turns a category name into a URL-safe anchor id */
function catAnchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, slug, description, phone, email, currency_code, country_code, timezone, logo_url, cover_image_url, catchline')
    .eq('slug', slug)
    .maybeSingle()

  if (!biz) notFound()

  // Locations — public fields only
  const { data: locsData } = await supabase
    .from('business_locations')
    .select('id, name, city, state_region, country_code, is_primary')
    .eq('business_id', biz.id)
    .order('is_primary', { ascending: false })

  const locations = locsData ?? []

  // Categories for this business
  const { data: catsData } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('business_id', biz.id)
    .order('name', { ascending: true })

  const categories = catsData ?? []

  // Active products with their first image
  const { data: prodsData } = await supabase
    .from('products')
    .select('id, name, description, sku, selling_price, category_id, product_images ( url, position )')
    .eq('business_id', biz.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const products = (prodsData ?? []).map((p) => {
    const imgs = Array.isArray(p.product_images) ? p.product_images : []
    imgs.sort((a, b) => a.position - b.position)
    return { ...p, firstImageUrl: imgs[0]?.url ?? null }
  })

  // Build category map for display
  const catMap: Record<string, string> = {}
  for (const c of categories) catMap[c.id] = c.name

  // Group products by category (null = uncategorised)
  const grouped: { catName: string; products: typeof products }[] = []
  const catOrder: string[] = [
    ...categories.map((c) => c.id),
    '__none__',
  ]
  const byCategory: Record<string, typeof products> = { __none__: [] }
  for (const c of categories) byCategory[c.id] = []
  for (const p of products) {
    const key = p.category_id ?? '__none__'
    if (!byCategory[key]) byCategory[key] = []
    byCategory[key].push(p)
  }
  for (const key of catOrder) {
    if (byCategory[key]?.length) {
      grouped.push({
        catName: key === '__none__' ? 'Other' : catMap[key],
        products: byCategory[key],
      })
    }
  }

  const currency = biz.currency_code ?? 'USD'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Back */}
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Stores
        </Link>

        {/* Cover photo */}
        {biz.cover_image_url && (
          <div className="w-full aspect-[3/1] rounded-2xl overflow-hidden bg-gray-100 dark:bg-neutral-800">
            <img
              src={biz.cover_image_url}
              alt={`${biz.name} cover`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Store header */}
        <div className="flex items-start gap-4">
          {biz.logo_url ? (
            <img
              src={biz.logo_url}
              alt={`${biz.name} logo`}
              className="shrink-0 w-16 h-16 rounded-2xl object-cover bg-gray-100 dark:bg-neutral-800"
            />
          ) : (
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-300">
              {biz.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 pt-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{biz.name}</h1>
            {biz.catchline && (
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                {biz.catchline}
              </p>
            )}
            {biz.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {biz.description}
              </p>
            )}
          </div>
        </div>

        {/* Contact info — tappable links */}
        {(biz.phone || biz.email) && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 space-y-2.5">
            {biz.phone && (
              <a
                href={`tel:${biz.phone}`}
                className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Phone size={14} className="text-gray-400 shrink-0" />
                {biz.phone}
              </a>
            )}
            {biz.email && (
              <a
                href={`mailto:${biz.email}`}
                className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Mail size={14} className="text-gray-400 shrink-0" />
                {biz.email}
              </a>
            )}
          </div>
        )}

        {/* Locations */}
        {locations.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Locations
              </p>
            </div>
            {locations.map((loc) => {
              const parts = [loc.city, loc.state_region, loc.country_code].filter(Boolean)
              const mapsQuery = parts.join(', ')
              return (
                <div key={loc.id} className="flex items-start gap-3 px-4 py-3">
                  <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    {loc.name && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</p>
                    )}
                    {parts.length > 0 && (
                      <a
                        href={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {parts.join(', ')}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Products */}
        {products.length > 0 ? (
          <div className="space-y-4">
            {/* Products heading + count */}
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Products</h2>
              <span className="text-xs text-gray-400 dark:text-neutral-500">
                {products.length} item{products.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Category pill nav — only shown when there are multiple categories */}
            {grouped.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
                {grouped.map(({ catName }) => (
                  <a
                    key={catName}
                    href={`#cat-${catAnchor(catName)}`}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {catName}
                  </a>
                ))}
              </div>
            )}

            {/* Grouped product sections */}
            {grouped.map(({ catName, products: catProds }) => (
              <div key={catName} id={`cat-${catAnchor(catName)}`} className="space-y-1 scroll-mt-16">
                {grouped.length > 1 && (
                  <div className="flex items-center gap-2 mb-2 pt-1">
                    <Tag size={11} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {catName}
                    </p>
                  </div>
                )}
                <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                  {catProds.map((p) => (
                    <div key={p.id} className="px-4 py-4">
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <Link href={`/products/${p.id}`} className="shrink-0">
                          {p.firstImageUrl ? (
                            <img
                              src={p.firstImageUrl}
                              alt={p.name}
                              className="w-16 h-16 rounded-xl object-cover bg-gray-100 dark:bg-neutral-800"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                              <Tag size={18} className="text-gray-300 dark:text-neutral-600" />
                            </div>
                          )}
                        </Link>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${p.id}`}
                            className="block hover:opacity-80 transition-opacity"
                          >
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                              {p.name}
                            </p>
                            {p.description && (
                              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                                {p.description}
                              </p>
                            )}
                          </Link>

                          {/* Price + Add to cart */}
                          <div className="flex items-center justify-between mt-2.5 gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                              {fmtCurrency(p.selling_price, currency)}
                            </span>
                            <AddToCartButton
                              businessId={biz.id}
                              businessSlug={biz.slug}
                              businessName={biz.name}
                              currencyCode={currency}
                              productId={p.id}
                              productName={p.name}
                              unitPrice={p.selling_price}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-12 text-center">
            <Tag size={28} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No products listed yet</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Check back soon.
            </p>
          </div>
        )}
      </div>
      <CartFab />
    </div>
  )
}
