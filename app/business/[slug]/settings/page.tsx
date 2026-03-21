import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings2, AlertCircle, CheckCircle2 } from 'lucide-react'
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

  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
  const inputCls =
    'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings2 size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Error / success banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          Settings saved.
        </div>
      )}

      <form action={action} className="space-y-5">
        {/* Business name */}
        <div>
          <label className={labelCls}>Business name <span className="text-red-500">*</span></label>
          <input
            name="name"
            type="text"
            required
            defaultValue={biz.name}
            placeholder="My Business"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={biz.description ?? ''}
            placeholder="A short description of your business"
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Phone */}
        <div>
          <label className={labelCls}>Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={biz.phone ?? ''}
            placeholder="+1 555 000 0000"
            className={inputCls}
          />
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Contact email</label>
          <input
            name="email"
            type="email"
            defaultValue={biz.email ?? ''}
            placeholder="contact@yourbusiness.com"
            className={inputCls}
          />
        </div>

        {/* Slug */}
        <div>
          <label className={labelCls}>
            URL slug <span className="text-red-500">*</span>
            <span className="ml-1.5 text-xs font-normal text-gray-400">(lowercase letters, numbers, hyphens only)</span>
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 py-2.5 rounded-l-lg border border-r-0 border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 text-sm">
              /business/
            </span>
            <input
              name="slug"
              type="text"
              required
              pattern="[a-z0-9-]+"
              defaultValue={biz.slug}
              placeholder="my-business"
              className={`${inputCls} rounded-l-none`}
            />
          </div>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Changing the slug will update your business URL and redirect you automatically.
          </p>
        </div>

        {/* Currency */}
        <div>
          <label className={labelCls}>Currency <span className="text-red-500">*</span></label>
          <select
            name="currency_code"
            required
            defaultValue={biz.currency_code}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
            {/* Allow current value even if not in list */}
            {!CURRENCIES.some((c) => c.code === biz.currency_code) && (
              <option value={biz.currency_code}>{biz.currency_code}</option>
            )}
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label className={labelCls}>Timezone <span className="text-red-500">*</span></label>
          <select
            name="timezone"
            required
            defaultValue={biz.timezone}
            className={inputCls}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
            {!TIMEZONES.includes(biz.timezone) && (
              <option value={biz.timezone}>{biz.timezone}</option>
            )}
          </select>
        </div>

        {/* Country */}
        <div>
          <label className={labelCls}>Country <span className="text-red-500">*</span></label>
          <select
            name="country_code"
            required
            defaultValue={biz.country_code}
            className={inputCls}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
            {!COUNTRIES.some((c) => c.code === biz.country_code) && (
              <option value={biz.country_code}>{biz.country_code}</option>
            )}
          </select>
        </div>

        {/* City */}
        <div>
          <label className={labelCls}>City <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            name="city"
            type="text"
            defaultValue={biz.city ?? ''}
            placeholder="e.g. Port Moresby"
            className={inputCls}
          />
        </div>

        {/* Read-only fields */}
        <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-3">
          <p className="text-xs text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wide">Read-only</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{ctx.business.status}</span>
          </div>
        </div>

        <div className="pt-1">
          <SubmitButton
            pendingText="Saving…"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            Save changes
          </SubmitButton>
        </div>
      </form>

      {/* Branding */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Branding</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Logo, cover photo, and catchline shown on your public store page.
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
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
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delivery &amp; Fulfillment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Configure how customers can receive their orders.
            </p>
          </div>

          <form action={deliveryAction} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-5">
            {/* Pickup toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pickup</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500">Customers collect from your location</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="pickup_enabled"
                  value="true"
                  defaultChecked={deliverySettings?.pickup_enabled !== false}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Delivery toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500">You deliver to the customer</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="delivery_enabled"
                  value="true"
                  defaultChecked={deliverySettings?.delivery_enabled === true}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Delivery fee */}
            <div>
              <label className={labelCls}>Delivery fee</label>
              <input
                name="delivery_fee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={deliverySettings?.delivery_fee ?? 0}
                placeholder="0.00"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Set to 0 for free delivery.</p>
            </div>

            {/* Free delivery threshold */}
            <div>
              <label className={labelCls}>Free delivery above (optional)</label>
              <input
                name="free_delivery_above"
                type="number"
                min="0"
                step="0.01"
                defaultValue={deliverySettings?.free_delivery_above ?? ''}
                placeholder="e.g. 200"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                Orders above this amount get free delivery. Leave blank to always charge the fee.
              </p>
            </div>

            {/* Estimated times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pickup time (optional)</label>
                <input
                  name="estimated_time_pickup"
                  type="text"
                  defaultValue={deliverySettings?.estimated_time_pickup ?? ''}
                  placeholder="e.g. 15–20 min"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Delivery time (optional)</label>
                <input
                  name="estimated_time_delivery"
                  type="text"
                  defaultValue={deliverySettings?.estimated_time_delivery ?? ''}
                  placeholder="e.g. 30–45 min"
                  className={inputCls}
                />
              </div>
            </div>

            <SubmitButton
              pendingText="Saving…"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              Save delivery settings
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  )
}
