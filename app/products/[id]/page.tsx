import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Store, Tag } from 'lucide-react'
import AddToCartButton from '@/components/AddToCartButton'
import CartFab from '@/components/CartFab'

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

  // Public fields only — no cost_price_default, no barcode
  const { data: product } = await supabase
    .from('products')
    .select(`
      id, name, description, sku, selling_price,
      businesses ( id, name, slug, description, phone, email, currency_code, country_code ),
      product_categories ( id, name )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!product) notFound()

  const biz = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses
  const cat = Array.isArray(product.product_categories) ? product.product_categories[0] : product.product_categories
  const currency = biz?.currency_code ?? 'USD'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Back */}
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={14} />
            Products
          </Link>
          {biz && (
            <>
              <span className="text-gray-300 dark:text-neutral-600">/</span>
              <Link
                href={`/businesses/${biz.slug}`}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate"
              >
                {biz.name}
              </Link>
            </>
          )}
        </div>

        {/* Product header */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
              {cat && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Tag size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{cat.name}</span>
                </div>
              )}
            </div>
            <span className="shrink-0 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {fmtCurrency(product.selling_price, currency)}
            </span>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{product.description}</p>
          )}

          {product.sku && (
            <p className="text-xs text-gray-400 dark:text-neutral-500">SKU: {product.sku}</p>
          )}

          {biz && (
            <AddToCartButton
              businessId={biz.id}
              businessSlug={biz.slug}
              businessName={biz.name}
              productId={product.id}
              productName={product.name}
              unitPrice={product.selling_price}
            />
          )}
        </div>

        {/* Business card */}
        {biz && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sold by</p>
            </div>
            <Link
              href={`/businesses/${biz.slug}`}
              className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300">
                {biz.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{biz.name}</p>
                {biz.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{biz.description}</p>
                )}
              </div>
              <Store size={16} className="text-gray-300 dark:text-neutral-600 shrink-0" />
            </Link>
            {(biz.phone || biz.email) && (
              <div className="px-4 pb-4 space-y-1 border-t border-gray-50 dark:border-neutral-800 pt-3">
                {biz.phone && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{biz.phone}</p>
                )}
                {biz.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{biz.email}</p>
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
