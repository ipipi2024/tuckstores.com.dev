import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { Settings2 } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_settings')) {
    redirect(`/business/${slug}/dashboard`)
  }

  const b = ctx.business

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
        {[
          { label: 'Business name',  value: b.name },
          { label: 'Slug',           value: b.slug },
          { label: 'Currency',       value: b.currency_code },
          { label: 'Country',        value: b.country_code },
          { label: 'Timezone',       value: b.timezone },
          { label: 'Status',         value: b.status },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
              {value}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-neutral-500">
        Full business settings editing coming soon.
      </p>
    </div>
  )
}
