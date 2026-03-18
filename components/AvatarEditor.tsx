'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveAvatar } from '@/app/app/profile/actions'
import { User, Camera, Loader2 } from 'lucide-react'

type Props = {
  userId: string
  initialAvatarUrl: string | null
  displayName?: string | null
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_MB = 5

export default function AvatarEditor({ userId, initialAvatarUrl, displayName }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    setError(null)

    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use JPEG, PNG, or WEBP.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Max ${MAX_MB} MB.`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const path = `users/${userId}/avatar`

      const { error: uploadError } = await supabase.storage
        .from('user-assets')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('user-assets')
        .getPublicUrl(path)

      setAvatarUrl(publicUrl)
      await saveAvatar(publicUrl, path)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const initials = displayName
    ? displayName.trim().charAt(0).toUpperCase()
    : null

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Circular avatar with camera overlay */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative w-16 h-16 rounded-full overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Change profile photo"
      >
        {/* Image or placeholder */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            {initials ? (
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-300">
                {initials}
              </span>
            ) : (
              <User size={26} className="text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
        )}

        {/* Hover overlay */}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 size={18} className="text-white animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
            <Camera
              size={18}
              className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )}
      </button>

      {/* Change / remove links */}
      {!uploading && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {avatarUrl ? 'Change' : 'Upload photo'}
          </button>
          {avatarUrl && (
            <>
              <span className="text-xs text-gray-300 dark:text-neutral-600">·</span>
              <button
                type="button"
                onClick={async () => {
                  setAvatarUrl(null)
                  await saveAvatar(null, null)
                  router.refresh()
                }}
                className="text-xs text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400"
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
