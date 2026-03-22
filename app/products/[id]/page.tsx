import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Tag, Store, Phone, Mail, ChevronRight } from 'lucide-react'
import AddToCartButton from '@/components/AddToCartButton'
import CartFab from '@/components/CartFab'
import ProductGallery from '@/components/ProductGallery'

type Props = { params: Promise<{ id: string }> }

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select(`
      id, name, description, sku, selling_price, measurement_type, base_unit,
      product_images ( url, position ),
      businesses ( id, name, slug, description, catchline, phone, email, currency_code, logo_url ),
      product_categories ( id, name )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!product) notFound()

  const biz = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses
  const cat = Array.isArray(product.product_categories) ? product.product_categories[0] : product.product_categories
  const currency = biz?.currency_code ?? 'USD'

  const images = (Array.isArray(product.product_images) ? product.product_images : [])
    .slice()
    .sort((a, b) => a.position - b.position)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mb-8 flex-wrap">
          <Link
            href="/businesses"
            className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 transition-colors"
          >
            Stores
          </Link>
          {biz && (
            <>
              <ChevronRight size={14} className="text-gray-300 dark:text-neutral-700 shrink-0" />
              <Link
                href={`/businesses/${biz.slug}`}
                className="text-gray-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[160px]"
              >
                {biz.name}
              </Link>
            </>
          )}
          <ChevronRight size={14} className="text-gray-300 dark:text-neutral-700 shrink-0" />
          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px] font-medium">
            {product.name}
          </span>
        </nav>

        {/* Main product section */}
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Image gallery */}
          <div className="w-full lg:w-[480px] shrink-0">
            <ProductGallery images={images} productName={product.name} />
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* Category badge */}
            {cat && (
              <div className="flex items-center gap-1.5">
                <Tag size={12} className="text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  {cat.name}
                </span>
              </div>
            )}

            {/* Name + price */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                {product.name}
              </h1>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-3 tabular-nums">
                {fmtCurrency(product.selling_price, currency)}
                {product.measurement_type !== 'unit' && (
                  <span className="text-base font-normal text-gray-400 dark:text-neutral-500 ml-1.5">
                    per {product.base_unit}
                  </span>
                )}
              </p>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* SKU */}
            {product.sku && (
              <p className="text-xs text-gray-400 dark:text-neutral-500">
                SKU: <span className="font-mono">{product.sku}</span>
              </p>
            )}

            {/* Add to cart */}
            {biz && (
              <div className="mt-auto pt-2">
                <AddToCartButton
                  businessId={biz.id}
                  businessSlug={biz.slug}
                  businessName={biz.name}
                  currencyCode={currency}
                  productId={product.id}
                  productName={product.name}
                  unitPrice={product.selling_price}
                  className="w-full justify-center py-3 text-base rounded-2xl"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sold by */}
        {biz && (
          <div className="mt-10 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
              <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Sold by</p>
            </div>
            <Link
              href={`/businesses/${biz.slug}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors group"
            >
              {biz.logo_url ? (
                <img
                  src={biz.logo_url}
                  alt={`${biz.name} logo`}
                  className="shrink-0 w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-neutral-800"
                />
              ) : (
                <div className="shrink-0 w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                  {biz.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {biz.name}
                </p>
                {(biz.catchline || biz.description) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {biz.catchline || biz.description}
                  </p>
                )}
              </div>
              <Store size={16} className="text-gray-300 dark:text-neutral-600 shrink-0 group-hover:text-indigo-400 transition-colors" />
            </Link>

            {(biz.phone || biz.email) && (
              <div className="px-5 pb-4 pt-1 flex flex-wrap gap-4 border-t border-gray-100 dark:border-neutral-800">
                {biz.phone && (
                  <a
                    href={`tel:${biz.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Phone size={13} className="text-gray-400" />
                    {biz.phone}
                  </a>
                )}
                {biz.email && (
                  <a
                    href={`mailto:${biz.email}`}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Mail size={13} className="text-gray-400" />
                    {biz.email}
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <CartFab />
    </div>
  )
}
