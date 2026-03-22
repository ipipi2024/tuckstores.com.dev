import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Phone, Mail, Tag, Store, ShoppingBag } from 'lucide-react'
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

  const { data: locsData } = await supabase
    .from('business_locations')
    .select('id, name, city, state_region, country_code, is_primary')
    .eq('business_id', biz.id)
    .order('is_primary', { ascending: false })

  const locations = locsData ?? []

  const { data: catsData } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('business_id', biz.id)
    .order('name', { ascending: true })

  const categories = catsData ?? []

  const { data: prodsData } = await supabase
    .from('products')
    .select('id, name, description, sku, selling_price, measurement_type, base_unit, category_id, product_images ( url, position )')
    .eq('business_id', biz.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const products = (prodsData ?? []).map((p) => {
    const imgs = Array.isArray(p.product_images) ? p.product_images : []
    imgs.sort((a, b) => a.position - b.position)
    return { ...p, firstImageUrl: imgs[0]?.url ?? null }
  })

  const catMap: Record<string, string> = {}
  for (const c of categories) catMap[c.id] = c.name

  const grouped: { catName: string; products: typeof products }[] = []
  const catOrder: string[] = [...categories.map((c) => c.id), '__none__']
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

      {/* Hero cover */}
      <div className="relative w-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/40 dark:to-neutral-900"
        style={{ minHeight: '260px' }}>
        {biz.cover_image_url ? (
          <img
            src={biz.cover_image_url}
            alt={`${biz.name} cover`}
            className="w-full h-full object-cover absolute inset-0"
            style={{ height: '260px' }}
          />
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: '260px' }}>
            <Store size={64} className="text-indigo-200 dark:text-indigo-800" />
          </div>
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/businesses"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full transition-colors"
          >
            <ArrowLeft size={14} />
            Stores
          </Link>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Business identity bar — logo overlaps hero */}
        <div className="relative -mt-12 mb-6 flex items-end gap-5">
          {/* Logo */}
          <div className="shrink-0 z-10">
            {biz.logo_url ? (
              <img
                src={biz.logo_url}
                alt={`${biz.name} logo`}
                className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white dark:ring-neutral-950 shadow-lg bg-white dark:bg-neutral-900"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl ring-4 ring-white dark:ring-neutral-950 shadow-lg bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                {biz.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + catchline */}
          <div className="pb-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
              {biz.name}
            </h1>
            {biz.catchline && (
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                {biz.catchline}
              </p>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8 items-start pb-16">

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Description */}
            {biz.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {biz.description}
              </p>
            )}

            {/* Products */}
            {products.length > 0 ? (
              <div className="space-y-5">
                {/* Header + count */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag size={18} className="text-indigo-500" />
                    Products
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full font-medium">
                    {products.length} item{products.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Sticky category nav */}
                {grouped.length > 1 && (
                  <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 bg-gray-50/90 dark:bg-neutral-950/90 backdrop-blur-sm border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex gap-2 overflow-x-auto scrollbar-none">
                      {grouped.map(({ catName }) => (
                        <a
                          key={catName}
                          href={`#cat-${catAnchor(catName)}`}
                          className="shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors shadow-sm"
                        >
                          {catName}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product sections */}
                {grouped.map(({ catName, products: catProds }) => (
                  <section key={catName} id={`cat-${catAnchor(catName)}`} className="scroll-mt-20">
                    {grouped.length > 1 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                        <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest px-2">
                          {catName}
                        </span>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {catProds.map((p) => (
                        <div
                          key={p.id}
                          className="group bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                          {/* Product image */}
                          <Link href={`/products/${p.id}`} className="block shrink-0">
                            <div className="aspect-square w-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                              {p.firstImageUrl ? (
                                <img
                                  src={p.firstImageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Tag size={28} className="text-gray-300 dark:text-neutral-600" />
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* Product info */}
                          <div className="flex flex-col flex-1 p-3 gap-2">
                            <Link href={`/products/${p.id}`} className="hover:opacity-80 transition-opacity flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">
                                {p.name}
                              </p>
                              {p.description && (
                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                                  {p.description}
                                </p>
                              )}
                            </Link>

                            <div className="flex flex-col gap-2 mt-auto pt-1">
                              <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                                {fmtCurrency(p.selling_price, currency)}
                                {p.measurement_type !== 'unit' && (
                                  <span className="text-xs font-normal text-gray-400 dark:text-neutral-500 ml-0.5">
                                    / {p.base_unit}
                                  </span>
                                )}
                              </span>
                              <AddToCartButton
                                businessId={biz.id}
                                businessSlug={biz.slug}
                                businessName={biz.name}
                                currencyCode={currency}
                                productId={p.id}
                                productName={p.name}
                                unitPrice={p.selling_price}
                                className="w-full justify-center"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-16 text-center">
                <ShoppingBag size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No products listed yet</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Check back soon.</p>
              </div>
            )}
          </div>

          {/* ── Sticky sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0 sticky top-6">

            {/* Contact */}
            {(biz.phone || biz.email) && (
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                  <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Contact</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {biz.phone && (
                    <a
                      href={`tel:${biz.phone}`}
                      className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                        <Phone size={14} className="text-indigo-500" />
                      </div>
                      <span className="truncate">{biz.phone}</span>
                    </a>
                  )}
                  {biz.email && (
                    <a
                      href={`mailto:${biz.email}`}
                      className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                        <Mail size={14} className="text-indigo-500" />
                      </div>
                      <span className="truncate">{biz.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Locations */}
            {locations.length > 0 && (
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                  <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Locations</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {locations.map((loc) => {
                    const parts = [loc.city, loc.state_region, loc.country_code].filter(Boolean)
                    const mapsQuery = parts.join(', ')
                    return (
                      <div key={loc.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin size={14} className="text-green-500" />
                        </div>
                        <div className="min-w-0">
                          {loc.name && (
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</p>
                          )}
                          {parts.length > 0 && (
                            <a
                              href={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {parts.join(', ')}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile contact + locations (shown below products on small screens) */}
        <div className="lg:hidden space-y-4 pb-16">
          {(biz.phone || biz.email) && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Contact</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {biz.phone && (
                  <a href={`tel:${biz.phone}`} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    {biz.phone}
                  </a>
                )}
                {biz.email && (
                  <a href={`mailto:${biz.email}`} className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    {biz.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {locations.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Locations</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {locations.map((loc) => {
                  const parts = [loc.city, loc.state_region, loc.country_code].filter(Boolean)
                  const mapsQuery = parts.join(', ')
                  return (
                    <div key={loc.id} className="flex items-start gap-3 px-4 py-3">
                      <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        {loc.name && <p className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</p>}
                        {parts.length > 0 && (
                          <a
                            href={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {parts.join(', ')}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <CartFab />
    </div>
  )
}
