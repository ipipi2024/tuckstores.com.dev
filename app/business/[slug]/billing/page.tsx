import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

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

export default async function BillingPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_subscription')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const supabase = await createClient()
  const { data: subData } = await supabase
    .from('business_subscriptions')
    .select(`
      status,
      starts_at,
      expires_at,
      trial_ends_at,
      billing_cycle,
      subscription_plans ( code, name, monthly_price, yearly_price )
    `)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  const plan = subData
    ? (Array.isArray(subData.subscription_plans)
        ? subData.subscription_plans[0]
        : subData.subscription_plans)
    : null

  const statusCfg = subData
    ? (STATUS_CONFIG[subData.status] ?? STATUS_CONFIG.expired)
    : null

  return (
    <div className="space-y-6">
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
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
          {/* Plan name + status */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current plan</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
                {plan?.name ?? '—'}
              </p>
            </div>
            {statusCfg && (
              <span className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
                <statusCfg.icon size={16} />
                {statusCfg.label}
              </span>
            )}
          </div>

          {[
            { label: 'Pricing',      value: plan?.monthly_price ? `$${plan.monthly_price}/mo` : 'Free' },
            { label: 'Started',      value: fmt(subData.starts_at) },
            { label: 'Trial ends',   value: fmt(subData.trial_ends_at) },
            { label: 'Expires',      value: fmt(subData.expires_at) },
            { label: 'Billing cycle', value: subData.billing_cycle ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-neutral-500">
        Self-serve billing portal coming soon. Contact support to upgrade or cancel.
      </p>
    </div>
  )
}
