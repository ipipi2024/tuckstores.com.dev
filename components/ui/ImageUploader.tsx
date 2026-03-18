'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'

export type UploadResult = { url: string; path: string }

type Props = {
  /** Supabase storage bucket name */
  bucket: string
  /** Full storage path for this image (no extension — content-type is set via metadata) */
  path: string
  /** Current image URL to show as preview */
  currentUrl?: string | null
  /** Called after a successful upload */
  onUpload: (result: UploadResult) => void
  /** Called when the user clicks the remove button. If omitted, no remove button is shown. */
  onRemove?: () => void
  /** Tailwind aspect-ratio class applied to the preview box (default: aspect-square) */
  aspectClass?: string
  /** Max file size in MB (default: 5) */
  maxSizeMb?: number
  /** Accepted MIME types (default: jpeg, png, webp) */
  accept?: string
  /** Optional label rendered above the preview */
  label?: string
  /** Extra class applied to the root wrapper */
  className?: string
}

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp'
const DEFAULT_MAX_MB = 5

export default function ImageUploader({
  bucket,
  path,
  currentUrl,
  onUpload,
  onRemove,
  aspectClass = 'aspect-square',
  maxSizeMb = DEFAULT_MAX_MB,
  accept = DEFAULT_ACCEPT,
  label,
  className = '',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploadError(null)

    // ── Validate type ──────────────────────────────────────────────────────
    const allowed = accept.split(',').map((t) => t.trim())
    if (!allowed.includes(file.type)) {
      setUploadError(`Unsupported file type. Allowed: JPEG, PNG, WEBP.`)
      return
    }

    // ── Validate size ──────────────────────────────────────────────────────
    if (file.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`File too large — max ${maxSizeMb} MB.`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (storageError) throw storageError

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path)

      onUpload({ url: publicUrl, path })
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </p>
      )}

      {/* Preview box */}
      <div
        className={`relative ${aspectClass} w-full rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900`}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon
              size={28}
              className="text-gray-300 dark:text-neutral-600"
            />
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
        )}

        {/* Remove button */}
        {currentUrl && onRemove && !uploading && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove image"
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          >
            <X size={13} className="text-white" />
          </button>
        )}
      </div>

      {/* Upload / change button */}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors"
      >
        <Upload size={12} />
        {currentUrl ? 'Change image' : 'Upload image'}
      </button>

      {uploadError && (
        <p className="text-xs text-red-500 dark:text-red-400">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          // Reset so the same file can be re-selected if needed
          e.target.value = ''
        }}
      />
    </div>
  )
}
