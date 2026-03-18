import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Clock, Users, MapPin, Check } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  trialing:  { label: 'Free Trial',   icon: Clock,         color: 'text-blue-600 dark:text-blue-400' },
  active:    { label: 'Active',       icon: CheckCircle2,  color: 'text-green-600 dark:text-green-400' },
  past_due:  { label: 'Past Due',     icon: AlertCircle,   color: 'text-red-600 dark:text-red-400' },
  expired:   { label: 'Expired',      icon: AlertCircle,   color: 'text-gray-500 dark:text-gray-400' },
  cancelled: { label: 'Cancelled',    icon: AlertCircle,   color: 'text-gray-500 dark:text-gray-400' },
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtPrice(monthly: number | null, yearly: number | null): string {
  if (!monthly && !yearly) return 'Free'
  if (monthly) return `$${Number(monthly).toFixed(2)}/mo`
  return `$${Number(yearly).toFixed(2)}/yr`
}

export default async function BillingPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_subscription')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()

  const [subResult, memberCountResult] = await Promise.all([
    supabase
      .from('business_subscriptions')
      .select(`
        status,
        starts_at,
        expires_at,
        trial_ends_at,
        billing_cycle,
        subscription_plans (
          code, name,
          monthly_price, yearly_price,
          max_members, max_locations,
          features_json
        )
      `)
      .eq('business_id', ctx.business.id)
      .maybeSingle(),

    supabase
      .from('business_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id)
      .eq('status', 'active'),
  ])

  const subData = subResult.data
  const memberCount = memberCountResult.count ?? 0

  const plan = subData
    ? (Array.isArray(subData.subscription_plans)
        ? subData.subscription_plans[0]
        : subData.subscription_plans)
    : null

  const statusCfg = subData
    ? (STATUS_CONFIG[subData.status] ?? STATUS_CONFIG.expired)
    : null

  // Normalise features_json: accept string[] or {feature: boolean} or null
  const features: string[] = (() => {
    if (!plan?.features_json) return []
    if (Array.isArray(plan.features_json)) return plan.features_json as string[]
    if (typeof plan.features_json === 'object') {
      return Object.entries(plan.features_json as Record<string, unknown>)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    }
    return []
  })()

  const maxMembers   = plan?.max_members   ?? null
  const maxLocations = plan?.max_locations ?? null

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Billing</h1>
      </div>

      {!subData ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-8 text-center">
          <AlertCircle size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No subscription found for this business.
          </p>
        </div>
      ) : (
        <>
          {/* Plan summary card */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
            {/* Plan name + status */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Current plan</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {plan?.name ?? '—'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {fmtPrice(plan?.monthly_price ?? null, plan?.yearly_price ?? null)}
                </p>
              </div>
              {statusCfg && (
                <span className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
                  <statusCfg.icon size={16} />
                  {statusCfg.label}
                </span>
              )}
            </div>

            {/* Dates */}
            {[
              { label: 'Started',       value: fmt(subData.starts_at) },
              subData.trial_ends_at
                ? { label: 'Trial ends', value: fmt(subData.trial_ends_at) }
                : null,
              subData.expires_at
                ? { label: 'Renews / expires', value: fmt(subData.expires_at) }
                : null,
              subData.billing_cycle
                ? { label: 'Billing cycle', value: subData.billing_cycle }
                : null,
            ]
              .filter((x): x is { label: string; value: string } => x !== null)
              .map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {value}
                  </span>
                </div>
              ))}
          </div>

          {/* Limits card */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
            <p className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Usage &amp; limits
            </p>

            {/* Members */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Users size={15} className="text-gray-400" />
                Active members
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {memberCount}
                <span className="text-gray-400 font-normal">
                  {' '}/ {maxMembers != null ? maxMembers : '∞'}
                </span>
              </span>
            </div>

            {/* Locations */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <MapPin size={15} className="text-gray-400" />
                Locations
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                <span className="text-gray-400 font-normal">
                  {maxLocations != null ? `up to ${maxLocations}` : 'Unlimited'}
                </span>
              </span>
            </div>
          </div>

          {/* Plan features */}
          {features.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Included features
              </p>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={14} className="text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual billing notice */}
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 px-5 py-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Need to upgrade or cancel?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              TuckStores uses manual billing. Email{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {process.env.NEXT_PUBLIC_BILLING_EMAIL ?? 'billing@tuckstores.com'}
              </span>{' '}
              with your business name and request. Plan changes are applied within one business day.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
