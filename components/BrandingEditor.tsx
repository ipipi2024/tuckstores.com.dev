'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ui/ImageUploader'
import SubmitButton from '@/components/ui/SubmitButton'
import { updateBusinessBranding } from '@/app/business/[slug]/settings/actions'

type Props = {
  slug: string
  businessId: string
  initialLogoUrl: string | null
  initialLogoPath: string | null
  initialCoverUrl: string | null
  initialCoverPath: string | null
  initialCatchline: string | null
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function BrandingEditor({
  slug,
  businessId,
  initialLogoUrl,
  initialLogoPath,
  initialCoverUrl,
  initialCoverPath,
  initialCatchline,
}: Props) {
  const [logoUrl, setLogoUrl]     = useState(initialLogoUrl ?? '')
  const [logoPath, setLogoPath]   = useState(initialLogoPath ?? '')
  const [coverUrl, setCoverUrl]   = useState(initialCoverUrl ?? '')
  const [coverPath, setCoverPath] = useState(initialCoverPath ?? '')

  const action = updateBusinessBranding.bind(null, slug)

  return (
    <form action={action} className="space-y-5">
      {/* Hidden inputs carry the current URL/path to the server action */}
      <input type="hidden" name="logo_url"          value={logoUrl} />
      <input type="hidden" name="logo_path"         value={logoPath} />
      <input type="hidden" name="cover_image_url"   value={coverUrl} />
      <input type="hidden" name="cover_image_path"  value={coverPath} />

      {/* Cover photo — wide aspect */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cover photo</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">
          Displayed as a banner on your public store page. Recommended 1200×400 px.
        </p>
        <ImageUploader
          bucket="business-assets"
          path={`businesses/${businessId}/cover`}
          currentUrl={coverUrl || null}
          onUpload={({ url, path }) => { setCoverUrl(url); setCoverPath(path) }}
          onRemove={() => { setCoverUrl(''); setCoverPath('') }}
          aspectClass="aspect-[3/1]"
          className="max-w-full"
        />
      </div>

      {/* Logo — square aspect */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">
          Square logo shown in your store header. Recommended 256×256 px.
        </p>
        <ImageUploader
          bucket="business-assets"
          path={`businesses/${businessId}/logo`}
          currentUrl={logoUrl || null}
          onUpload={({ url, path }) => { setLogoUrl(url); setLogoPath(path) }}
          onRemove={() => { setLogoUrl(''); setLogoPath('') }}
          aspectClass="aspect-square"
          className="w-28"
        />
      </div>

      {/* Catchline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Catchline
        </label>
        <input
          name="catchline"
          type="text"
          defaultValue={initialCatchline ?? ''}
          placeholder="e.g. Fresh groceries delivered to your door"
          maxLength={160}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
          A short tagline shown under your business name on your public store page.
        </p>
      </div>

      <SubmitButton
        pendingText="Saving…"
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        Save branding
      </SubmitButton>
    </form>
  )
}
