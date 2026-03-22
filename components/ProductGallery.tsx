'use client'

import { useState } from 'react'
import { Tag } from 'lucide-react'

type Image = { url: string; position: number }

export default function ProductGallery({
  images,
  productName,
}: {
  images: Image[]
  productName: string
}) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
        <Tag size={48} className="text-gray-300 dark:text-neutral-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-neutral-800">
        <img
          src={images[active].url}
          alt={productName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnail strip — only shown when there are multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === active
                  ? 'border-indigo-500 shadow-md'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt={`${productName} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
