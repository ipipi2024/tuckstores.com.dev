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
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Back */}
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
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

        {/* Business header */}
        <div className="flex items-start gap-4">
          {/* Logo or letter avatar */}
          {biz.logo_url ? (
            <img
              src={biz.logo_url}
              alt={`${biz.name} logo`}
              className="shrink-0 w-14 h-14 rounded-2xl object-cover bg-gray-100 dark:bg-neutral-800"
            />
          ) : (
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-300">
              {biz.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{biz.name}</h1>
            {biz.catchline && (
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                {biz.catchline}
              </p>
            )}
            {biz.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{biz.description}</p>
            )}
          </div>
        </div>

        {/* Contact info */}
        {(biz.phone || biz.email) && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 space-y-2">
            {biz.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Phone size={14} className="text-gray-400 shrink-0" />
                {biz.phone}
              </div>
            )}
            {biz.email && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Mail size={14} className="text-gray-400 shrink-0" />
                {biz.email}
              </div>
            )}
          </div>
        )}

        {/* Locations */}
        {locations.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Locations</p>
            </div>
            {locations.map((loc) => {
              const parts = [loc.city, loc.state_region, loc.country_code].filter(Boolean)
              return (
                <div key={loc.id} className="flex items-start gap-3 px-4 py-3">
                  <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    {loc.name && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</p>
                    )}
                    {parts.length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{parts.join(', ')}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Products</h2>
            {grouped.map(({ catName, products: catProds }) => (
              <div key={catName} className="space-y-1">
                {grouped.length > 1 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={12} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {catName}
                    </p>
                  </div>
                )}
                <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                  {catProds.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                      {/* Product thumbnail */}
                      <Link href={`/products/${p.id}`} className="shrink-0">
                        {p.firstImageUrl ? (
                          <img
                            src={p.firstImageUrl}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-neutral-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                            <Tag size={16} className="text-gray-300 dark:text-neutral-600" />
                          </div>
                        )}
                      </Link>
                      <Link href={`/products/${p.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{p.description}</p>
                        )}
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
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
                        className="shrink-0 !py-1.5 !px-3 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {products.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-8">
            No products listed yet.
          </p>
        )}
      </div>
      <CartFab />
    </div>
  )
}
