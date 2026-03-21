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

const lbl = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
const inp =
  'w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors'

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
    <form action={action} className="space-y-6">
      {/* Hidden inputs carry the current URL/path to the server action */}
      <input type="hidden" name="logo_url"         value={logoUrl} />
      <input type="hidden" name="logo_path"        value={logoPath} />
      <input type="hidden" name="cover_image_url"  value={coverUrl} />
      <input type="hidden" name="cover_image_path" value={coverPath} />

      {/* Cover photo */}
      <div>
        <p className={lbl}>Cover photo</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2.5">
          Banner shown on your public store page. Recommended 1200×400 px.
        </p>
        <ImageUploader
          bucket="business-assets"
          path={`businesses/${businessId}/cover`}
          currentUrl={coverUrl || null}
          onUpload={({ url, path }) => { setCoverUrl(url); setCoverPath(path) }}
          onRemove={() => { setCoverUrl(''); setCoverPath('') }}
          aspectClass="aspect-[3/1]"
          className="w-full"
        />
      </div>

      {/* Logo */}
      <div>
        <p className={lbl}>Logo</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2.5">
          Square logo shown in your store header. Recommended 256×256 px.
        </p>
        <ImageUploader
          bucket="business-assets"
          path={`businesses/${businessId}/logo`}
          currentUrl={logoUrl || null}
          onUpload={({ url, path }) => { setLogoUrl(url); setLogoPath(path) }}
          onRemove={() => { setLogoUrl(''); setLogoPath('') }}
          aspectClass="aspect-square"
          className="w-24"
        />
      </div>

      {/* Catchline */}
      <div>
        <label className={lbl}>Catchline</label>
        <input
          name="catchline"
          type="text"
          defaultValue={initialCatchline ?? ''}
          placeholder="e.g. Fresh groceries delivered to your door"
          maxLength={160}
          className={inp}
        />
        <p className="mt-1.5 text-xs text-gray-400 dark:text-neutral-500">
          Short tagline shown under your business name on your store page.
        </p>
      </div>

      <SubmitButton
        pendingText="Saving…"
        className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
      >
        Save branding
      </SubmitButton>
    </form>
  )
}
