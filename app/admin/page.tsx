import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { grantSubscription, approveVendor, rejectVendor } from './actions'
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

  const [{ data: businesses }, { data: plans }, { data: vendorApplications }] = await Promise.all([
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
    admin
      .from('vendor_applications')
      .select('id, user_id, email, name, notes, status, admin_notes, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const now = new Date()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Manage vendor applications and subscriptions.
          </p>
        </div>

        {/* Vendor Applications */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Vendor Applications
            {vendorApplications && vendorApplications.filter(a => a.status === 'pending').length > 0 && (
              <span className="ml-2 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                {vendorApplications.filter(a => a.status === 'pending').length} pending
              </span>
            )}
          </h2>

          {(!vendorApplications || vendorApplications.length === 0) && (
            <p className="text-sm text-gray-400">No vendor applications yet.</p>
          )}

          {vendorApplications?.map(app => (
            <div
              key={app.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{app.name}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">{app.email}</p>
                  {app.notes && (
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-sm">{app.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                    {new Date(app.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  app.status === 'pending'
                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                    : app.status === 'approved'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                }`}>
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
              </div>

              {app.status === 'pending' && (
                <div className="flex flex-col gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800">
                  {/* Approve */}
                  <form action={approveVendor} className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="vendor_user_id"  value={app.user_id} />
                    <input
                      name="admin_notes"
                      placeholder="Admin notes (optional)"
                      className="flex-1 text-xs border border-gray-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-700 dark:text-white placeholder-gray-400 min-w-0"
                    />
                    <select
                      name="store_limit"
                      defaultValue="1"
                      className="text-xs border border-gray-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-700 dark:text-white"
                    >
                      <option value="1">1 store</option>
                      <option value="2">2 stores</option>
                      <option value="3">3 stores</option>
                      <option value="5">5 stores</option>
                      <option value="10">10 stores</option>
                    </select>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors whitespace-nowrap"
                    >
                      Approve
                    </button>
                  </form>

                  {/* Reject */}
                  <form action={rejectVendor} className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="vendor_user_id"  value={app.user_id} />
                    <input
                      name="admin_notes"
                      placeholder="Reason for rejection (optional)"
                      className="flex-1 text-xs border border-gray-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-700 dark:text-white placeholder-gray-400 min-w-0"
                    />
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors whitespace-nowrap"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )}

              {app.admin_notes && app.status !== 'pending' && (
                <p className="text-xs text-gray-500 dark:text-neutral-400 border-t border-gray-100 dark:border-neutral-800 pt-2">
                  Note: {app.admin_notes}
                </p>
              )}
            </div>
          ))}
        </div>

        <hr className="border-gray-200 dark:border-neutral-800" />

        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Subscriptions</h2>
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
