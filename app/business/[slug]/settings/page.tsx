import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle2, Package, Truck } from 'lucide-react'
import { updateBusinessSettings, updateDeliverySettings } from './actions'
import SubmitButton from '@/components/ui/SubmitButton'
import { isAtLeastRole } from '@/lib/auth/permissions'
import BrandingEditor from '@/components/BrandingEditor'

type Props = {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

// Common IANA timezones for the select dropdown
const TIMEZONES = [
  'UTC',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Africa/Cairo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Pacific/Auckland',
]

const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'ZW', name: 'Zimbabwe' },
]

// Common ISO 4217 currency codes
const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'PGK', label: 'PGK — Papua New Guinea Kina' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
]

export default async function SettingsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error, success } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_settings')) {
    redirect(`/business/${slug}/dashboard`)
  }

  // Fetch full business record (ctx.business omits description, phone, email)
  const supabase = await createClient()
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, slug, description, phone, email, currency_code, country_code, city, timezone, logo_url, logo_path, cover_image_url, cover_image_path, catchline')
    .eq('id', ctx.business.id)
    .single()

  if (!biz) redirect(`/business/${slug}/dashboard`)

  // Fetch delivery settings if admin+
  const isAdmin = isAtLeastRole(ctx.membership.role, 'admin')
  const { data: deliverySettings } = isAdmin
    ? await supabase
        .from('business_delivery_settings')
        .select('pickup_enabled, delivery_enabled, delivery_fee, free_delivery_above, estimated_time_pickup, estimated_time_delivery')
        .eq('business_id', ctx.business.id)
        .maybeSingle()
    : { data: null }

  const action         = updateBusinessSettings.bind(null, slug)
  const deliveryAction = updateDeliverySettings.bind(null, slug)

  // ── Design tokens ──────────────────────────────────────────────────────────
  const card   = 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden'
  const cardHd = 'px-6 py-5 border-b border-gray-100 dark:border-neutral-800'
  const cardBd = 'p-6'

  const lbl = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
  const inp = 'w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors'
  const txta = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none'
  const btn  = 'w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60'
  const divider = <div className="border-t border-gray-100 dark:border-neutral-800" />

  const statusColors: Record<string, string> = {
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const badgeCls = statusColors[ctx.business.status] ?? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400'

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Business Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your business information, branding, and fulfillment options.
        </p>
      </div>

      {/* ── Banners ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          Settings saved successfully.
        </div>
      )}

      {/* ── Two-column grid ──────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-6 items-start">

        {/* ── Left: Business Details ───────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className={`${card} shadow-md`}>
            <div className={cardHd}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Business Details</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Update your public store information.
              </p>
            </div>

            <div className={cardBd}>
              <form action={action} className="space-y-5">

                {/* Business name */}
                <div>
                  <label className={lbl}>
                    Business name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={biz.name}
                    placeholder="My Business"
                    className={inp}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={lbl}>Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={biz.description ?? ''}
                    placeholder="A short description of your business"
                    className={txta}
                  />
                </div>

                {/* Phone + Email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Phone</label>
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={biz.phone ?? ''}
                      placeholder="+1 555 000 0000"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Contact email</label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={biz.email ?? ''}
                      placeholder="contact@yourbusiness.com"
                      className={inp}
                    />
                  </div>
                </div>

                {/* URL slug */}
                <div>
                  <label className={lbl}>
                    URL slug <span className="text-red-500">*</span>
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      (lowercase, numbers, hyphens)
                    </span>
                  </label>
                  <div className="flex h-10">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 text-sm whitespace-nowrap">
                      /business/
                    </span>
                    <input
                      name="slug"
                      type="text"
                      required
                      pattern="[a-z0-9-]+"
                      defaultValue={biz.slug}
                      placeholder="my-business"
                      className={`${inp} rounded-l-none`}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    Changing the slug updates your business URL and redirects you automatically.
                  </p>
                </div>

                {/* Currency + Timezone */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Currency <span className="text-red-500">*</span></label>
                    <select name="currency_code" required defaultValue={biz.currency_code} className={inp}>
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                      {!CURRENCIES.some((c) => c.code === biz.currency_code) && (
                        <option value={biz.currency_code}>{biz.currency_code}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Timezone <span className="text-red-500">*</span></label>
                    <select name="timezone" required defaultValue={biz.timezone} className={inp}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                      {!TIMEZONES.includes(biz.timezone) && (
                        <option value={biz.timezone}>{biz.timezone}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Country + City */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Country <span className="text-red-500">*</span></label>
                    <select name="country_code" required defaultValue={biz.country_code} className={inp}>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                      {!COUNTRIES.some((c) => c.code === biz.country_code) && (
                        <option value={biz.country_code}>{biz.country_code}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>
                      City <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      name="city"
                      type="text"
                      defaultValue={biz.city ?? ''}
                      placeholder="e.g. Port Moresby"
                      className={inp}
                    />
                  </div>
                </div>

                {/* Status — read-only */}
                <div className="pt-1">
                  {divider}
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Store status</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                        Managed by your subscription plan.
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeCls}`}>
                      {ctx.business.status}
                    </span>
                  </div>
                  {divider}
                </div>

                {/* Save */}
                <SubmitButton pendingText="Saving…" className={btn}>
                  Save changes
                </SubmitButton>

              </form>
            </div>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Branding card */}
          <div className={`${card} shadow-sm`}>
            <div className={cardHd}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Branding</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Logo, cover photo, and tagline for your store page.
              </p>
            </div>
            <div className={cardBd}>
              <BrandingEditor
                slug={slug}
                businessId={biz.id}
                initialLogoUrl={biz.logo_url ?? null}
                initialLogoPath={biz.logo_path ?? null}
                initialCoverUrl={biz.cover_image_url ?? null}
                initialCoverPath={biz.cover_image_path ?? null}
                initialCatchline={biz.catchline ?? null}
              />
            </div>
          </div>

          {/* Delivery & Fulfillment — admin+ only */}
          {isAdmin && (
            <div className={`${card} shadow-sm`}>
              <div className={cardHd}>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Delivery &amp; Fulfillment
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Configure how customers receive their orders.
                </p>
              </div>

              <div className={cardBd}>
                <form action={deliveryAction} className="space-y-5">

                  {/* Pickup toggle */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Package size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pickup</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">
                          Customers collect from your location
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        name="pickup_enabled"
                        value="true"
                        defaultChecked={deliverySettings?.pickup_enabled !== false}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  {divider}

                  {/* Delivery toggle */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Truck size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">
                          You deliver to the customer
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        name="delivery_enabled"
                        value="true"
                        defaultChecked={deliverySettings?.delivery_enabled === true}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  {divider}

                  {/* Delivery fee + Free above */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Delivery fee</label>
                      <input
                        name="delivery_fee"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={deliverySettings?.delivery_fee ?? 0}
                        placeholder="0.00"
                        className={inp}
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">Set to 0 for free.</p>
                    </div>
                    <div>
                      <label className={lbl}>
                        Free above <span className="text-gray-400 font-normal">(opt.)</span>
                      </label>
                      <input
                        name="free_delivery_above"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={deliverySettings?.free_delivery_above ?? ''}
                        placeholder="e.g. 200"
                        className={inp}
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">Leave blank to always charge.</p>
                    </div>
                  </div>

                  {/* Estimated times */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>
                        Pickup time <span className="text-gray-400 font-normal">(opt.)</span>
                      </label>
                      <input
                        name="estimated_time_pickup"
                        type="text"
                        defaultValue={deliverySettings?.estimated_time_pickup ?? ''}
                        placeholder="e.g. 15–20 min"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        Delivery time <span className="text-gray-400 font-normal">(opt.)</span>
                      </label>
                      <input
                        name="estimated_time_delivery"
                        type="text"
                        defaultValue={deliverySettings?.estimated_time_delivery ?? ''}
                        placeholder="e.g. 30–45 min"
                        className={inp}
                      />
                    </div>
                  </div>

                  <SubmitButton pendingText="Saving…" className={btn}>
                    Save delivery settings
                  </SubmitButton>

                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
