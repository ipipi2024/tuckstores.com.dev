'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
} from '@/app/business/[slug]/products/[id]/imageActions'
import { Plus, X, Loader2, ArrowLeft, ArrowRight, ImageIcon } from 'lucide-react'

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

export default function ProductImagesEditor({
  slug,
  productId,
  initialImages,
}: Props) {
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
        // Clean up orphaned storage file on DB failure
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Images
          <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-neutral-500">
            {images.length}/{MAX_IMAGES}
          </span>
        </p>
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          First image shown as thumbnail. JPEG, PNG, WEBP · max {MAX_MB} MB each.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {images.map((img, i) => (
          <div
            key={img.id}
            className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 group"
          >
            <img
              src={img.url}
              alt={`Product image ${i + 1}`}
              className="w-full h-full object-cover"
            />

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemove(img)}
              aria-label="Remove image"
              className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={11} className="text-white" />
            </button>

            {/* Position indicator */}
            <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 rounded px-1">
              {i + 1}
            </span>

            {/* Reorder buttons */}
            <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => handleMove(i, 'up')}
                  aria-label="Move left"
                  className="w-5 h-5 bg-black/60 hover:bg-black/80 rounded flex items-center justify-center"
                >
                  <ArrowLeft size={10} className="text-white" />
                </button>
              )}
              {i < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleMove(i, 'down')}
                  aria-label="Move right"
                  className="w-5 h-5 bg-black/60 hover:bg-black/80 rounded flex items-center justify-center"
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
            className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-neutral-500 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Plus size={18} />
                <span className="text-[10px]">Add photo</span>
              </>
            )}
          </button>
        )}

        {/* Empty state placeholder */}
        {images.length === 0 && !uploading && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 self-center ml-2">
            No images yet — click &ldquo;Add photo&rdquo; to get started.
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
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
