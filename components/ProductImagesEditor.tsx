'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
} from '@/app/business/[slug]/products/[id]/imageActions'
import { Plus, X, Loader2, ArrowLeft, ArrowRight, ImageIcon, Upload } from 'lucide-react'

type ProductImage = {
  id: string
  url: string
  storage_path: string
  position: number
}

type Props = {
  slug: string
  productId: string
  initialImages: ProductImage[]
}

const MAX_IMAGES = 5
const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_MB = 5

export default function ProductImagesEditor({ slug, productId, initialImages }: Props) {
  const [images, setImages] = useState<ProductImage[]>(
    [...initialImages].sort((a, b) => a.position - b.position)
  )
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFileSelect(file: File) {
    setError(null)

    if (images.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images per product.`)
      return
    }

    const allowed = ACCEPT.split(',').map((t) => t.trim())
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Use JPEG, PNG, or WEBP.')
      return
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large — max ${MAX_MB} MB.`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const storagePath = `products/${productId}/${crypto.randomUUID()}`

      const { error: storageError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, { contentType: file.type })

      if (storageError) throw storageError

      const {
        data: { publicUrl },
      } = supabase.storage.from('product-images').getPublicUrl(storagePath)

      const result = await addProductImage(slug, productId, publicUrl, storagePath)

      if (result.error) {
        await supabase.storage.from('product-images').remove([storagePath])
        setError(result.error)
        return
      }

      setImages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), url: publicUrl, storage_path: storagePath, position: prev.length },
      ])
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(img: ProductImage) {
    setError(null)
    const result = await removeProductImage(slug, img.id, img.storage_path)
    if (result.error) {
      setError(result.error)
      return
    }
    const updated = images
      .filter((i) => i.id !== img.id)
      .map((i, idx) => ({ ...i, position: idx }))
    setImages(updated)
    router.refresh()
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    setError(null)
    const newImages = [...images]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newImages[index], newImages[swapIndex]] = [newImages[swapIndex], newImages[index]]
    const reordered = newImages.map((img, i) => ({ ...img, position: i }))
    setImages(reordered)

    const result = await reorderProductImages(
      slug,
      productId,
      reordered.map((i) => i.id)
    )
    if (result.error) setError(result.error)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Counter + hint */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          {images.length} / {MAX_IMAGES} images
          {images.length > 0 && ' · First image shown as primary'}
        </p>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          JPEG, PNG, WEBP · max {MAX_MB} MB
        </p>
      </div>

      {/* Empty state — large dashed zone */}
      {images.length === 0 && (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 disabled:opacity-50 transition-colors py-10 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-neutral-500"
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          ) : (
            <>
              <div className="p-3 rounded-full bg-gray-100 dark:bg-neutral-800">
                <ImageIcon size={22} className="text-gray-400 dark:text-neutral-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Upload product images</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Click to browse</p>
              </div>
            </>
          )}
        </button>
      )}

      {/* Image tiles */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 group"
              style={{ width: i === 0 ? 112 : 80, height: i === 0 ? 112 : 80 }}
            >
              <img
                src={img.url}
                alt={`Product image ${i + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Primary badge */}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide text-white bg-black/60 rounded px-1.5 py-0.5">
                  Primary
                </span>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(img)}
                aria-label="Remove image"
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/85 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} className="text-white" />
              </button>

              {/* Reorder buttons */}
              <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMove(i, 'up')}
                    aria-label="Move left"
                    className="w-5 h-5 bg-black/60 hover:bg-black/85 rounded flex items-center justify-center"
                  >
                    <ArrowLeft size={10} className="text-white" />
                  </button>
                )}
                {i < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleMove(i, 'down')}
                    aria-label="Move right"
                    className="w-5 h-5 bg-black/60 hover:bg-black/85 rounded flex items-center justify-center"
                  >
                    <ArrowRight size={10} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add slot */}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-neutral-500 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-500 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Upload size={16} />
                  <span className="text-[10px]">Add</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
