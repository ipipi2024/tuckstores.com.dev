import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { grantSubscription } from './actions'
import { GrantButton } from './GrantCreditButton'

const STATUS_COLOR: Record<string, string> = {
  active:    'text-green-600 dark:text-green-400',
  trialing:  'text-blue-600 dark:text-blue-400',
  past_due:  'text-red-500',
  expired:   'text-gray-400',
  cancelled: 'text-gray-400',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/')

  const admin = createAdminClient()

  const [{ data: businesses }, { data: plans }] = await Promise.all([
    admin
      .from('businesses')
      .select(`
        id, name, slug, status, created_at,
        business_subscriptions (
          status, starts_at, expires_at, trial_ends_at,
          subscription_plans ( code, name )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('subscription_plans')
      .select('code, name')
      .order('name'),
  ])

  const now = new Date()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin — Subscriptions</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Grant or extend subscriptions for any business.
          </p>
        </div>

        {(!businesses || businesses.length === 0) && (
          <p className="text-sm text-gray-400">No businesses found.</p>
        )}

        <div className="space-y-3">
          {businesses?.map(biz => {
            const sub = Array.isArray(biz.business_subscriptions)
              ? biz.business_subscriptions[0]
              : biz.business_subscriptions ?? null
            const plan = sub
              ? (Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans)
              : null

            const expiry = sub?.expires_at ?? sub?.trial_ends_at ?? null
            const isActive = sub &&
              (sub.status === 'active' || sub.status === 'trialing') &&
              (!expiry || new Date(expiry) > now)

            const daysLeft = expiry
              ? Math.ceil((new Date(expiry).getTime() - now.getTime()) / 86400000)
              : null

            return (
              <div
                key={biz.id}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{biz.name}</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500">/{biz.slug}</p>
                    <div className="mt-1 text-xs">
                      {sub ? (
                        <span className={STATUS_COLOR[sub.status] ?? 'text-gray-400'}>
                          {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                          {plan ? ` · ${plan.name}` : ''}
                          {expiry ? ` · ${isActive ? `${daysLeft}d left` : 'expired'} (${fmt(expiry)})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">No subscription</span>
                      )}
                    </div>
                  </div>

                  <form action={grantSubscription} className="flex items-center gap-2 flex-shrink-0">
                    <input type="hidden" name="business_id" value={biz.id} />
                    <select
                      name="plan_code"
                      className="text-xs border border-gray-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-700 dark:text-white"
                    >
                      {plans?.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      name="months"
                      className="text-xs border border-gray-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-700 dark:text-white"
                    >
                      <option value="1">+1 month</option>
                      <option value="3">+3 months</option>
                      <option value="6">+6 months</option>
                      <option value="12">+12 months</option>
                    </select>
                    <GrantButton />
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
