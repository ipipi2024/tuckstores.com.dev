'use client'

import Link from 'next/link'
import { useState } from 'react'

type Product = { id: string; name: string }
type Item = { product_id: string; quantity: string; unit_price: string }

export default function NewSaleForm({
  products,
  error,
  action,
}: {
  products: Product[]
  error?: string
  action: (formData: FormData) => Promise<void>
}) {
  const [items, setItems] = useState<Item[]>([
    { product_id: '', quantity: '1', unit_price: '' },
  ])

  function addItem() {
    setItems((prev) => [...prev, { product_id: '', quantity: '1', unit_price: '' }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const total = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/sales" className="text-sm text-gray-400 hover:text-black">
            ← Sales
          </Link>
          <h1 className="text-2xl font-semibold mt-1">New sale</h1>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <form action={action} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input
              name="notes"
              type="text"
              placeholder="e.g. Morning shift, Table 4..."
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-black underline"
              >
                + Add item
              </button>
            </div>

            <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 text-xs text-gray-400 px-1">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span />
            </div>

            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                <input type="hidden" name={`product_id_${index}`} value={item.product_id} />
                <input type="hidden" name={`quantity_${index}`} value={item.quantity} />
                <input type="hidden" name={`unit_price_${index}`} value={item.unit_price} />

                <select
                  value={item.product_id}
                  onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                  required
                  className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  required
                  className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                  required
                  className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="text-gray-300 hover:text-red-400 disabled:opacity-20 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t">
              <p className="text-sm font-medium">
                Total: <span className="text-black">${total.toFixed(2)}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
            >
              Record sale
            </button>
            <Link
              href="/dashboard/sales"
              className="px-5 py-2 border text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
