import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Tag,
  PackagePlus,
  ShoppingCart,
  Users,
  Boxes,
  Truck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

export default async function DashboardPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)
  const supabase = await createClient()

  // Parallel stat queries
  const [productsRes, membersRes, suppliersRes] = await Promise.all([
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id)
      .eq('is_active', true),
    supabase
      .from('business_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id)
      .eq('status', 'active'),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id),
  ])

  const productCount = productsRes.count ?? 0
  const memberCount = membersRes.count ?? 0
  const supplierCount = suppliersRes.count ?? 0

  const subscriptionOk = isSubscriptionActive(ctx)

  const stats = [
    { label: 'Active Products', value: productCount, icon: Tag,        href: `/business/${slug}/products` },
    { label: 'Team Members',    value: memberCount,   icon: Users,      href: `/business/${slug}/staff` },
    { label: 'Suppliers',       value: supplierCount, icon: Truck,      href: `/business/${slug}/suppliers` },
  ]

  const quickLinks = [
    { label: 'POS',       icon: ShoppingCart, href: `/business/${slug}/pos`,       roles: ['owner','admin','manager','cashier'] },
    { label: 'Products',  icon: Tag,          href: `/business/${slug}/products`,  roles: ['owner','admin','manager','cashier','inventory_clerk','staff'] },
    { label: 'Purchases', icon: PackagePlus,  href: `/business/${slug}/purchases`, roles: ['owner','admin','manager','inventory_clerk'] },
    { label: 'Inventory', icon: Boxes,        href: `/business/${slug}/inventory`, roles: ['owner','admin','manager','cashier','inventory_clerk','staff'] },
    { label: 'Sales',     icon: TrendingUp,   href: `/business/${slug}/sales`,     roles: ['owner','admin','manager','cashier'] },
    { label: 'Staff',     icon: Users,        href: `/business/${slug}/staff`,     roles: ['owner','admin'] },
  ].filter((l) => l.roles.includes(ctx.membership.role))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {ctx.business.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
          Your role: <span className="font-medium">{ctx.membership.role}</span>
        </p>
      </div>

      {/* Subscription alert */}
      {!subscriptionOk && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Subscription is not active. Some operations may be blocked.{' '}
            {(ctx.membership.role === 'owner' || ctx.membership.role === 'admin') && (
              <Link href={`/business/${slug}/billing`} className="underline font-medium">
                Go to Billing
              </Link>
            )}
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} className="text-gray-400 dark:text-neutral-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-3">
          Quick access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickLinks.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
