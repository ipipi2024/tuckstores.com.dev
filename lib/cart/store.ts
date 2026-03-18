'use client'

/**
 * Client-side cart store backed by localStorage.
 *
 * Rules:
 *  - Cart is scoped to a single business. Adding a product from a different
 *    business clears the existing cart first (caller must confirm with user).
 *  - Prices stored here are DISPLAY-ONLY. The create_order RPC re-reads
 *    authoritative prices from the DB at placement time.
 */

export type CartItem = {
  productId: string
  productName: string
  /** Display price only — server will re-read the real price */
  unitPrice: number
  quantity: number
}

export type Cart = {
  businessId: string
  businessSlug: string
  businessName: string
  items: CartItem[]
}

const KEY = 'ts_cart'

function load(): Cart | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Cart) : null
  } catch {
    return null
  }
}

function save(cart: Cart | null) {
  if (typeof window === 'undefined') return
  if (cart === null) {
    localStorage.removeItem(KEY)
  } else {
    localStorage.setItem(KEY, JSON.stringify(cart))
  }
}

export function getCart(): Cart | null {
  return load()
}

export function clearCart() {
  save(null)
  window.dispatchEvent(new Event('cart-updated'))
}

/**
 * Add a product to the cart.
 * Returns `{ conflict: true, existing: Cart }` when the product belongs to a
 * different business than the current cart. The caller should confirm with
 * the user, then call `clearCartAndAdd` if they want to start a new cart.
 */
export function addToCart(
  businessId: string,
  businessSlug: string,
  businessName: string,
  product: Omit<CartItem, 'quantity'>,
  quantity = 1
): { conflict: true; existing: Cart } | { conflict: false } {
  const cart = load()

  if (cart && cart.businessId !== businessId) {
    return { conflict: true, existing: cart }
  }

  const base: Cart = cart ?? { businessId, businessSlug, businessName, items: [] }

  const existing = base.items.find((i) => i.productId === product.productId)
  if (existing) {
    existing.quantity += quantity
  } else {
    base.items.push({ ...product, quantity })
  }

  save(base)
  window.dispatchEvent(new Event('cart-updated'))
  return { conflict: false }
}

/** Clear existing cart and start a new one with the given product. */
export function clearCartAndAdd(
  businessId: string,
  businessSlug: string,
  businessName: string,
  product: Omit<CartItem, 'quantity'>,
  quantity = 1
) {
  save(null)
  addToCart(businessId, businessSlug, businessName, product, quantity)
}

export function removeFromCart(productId: string) {
  const cart = load()
  if (!cart) return
  cart.items = cart.items.filter((i) => i.productId !== productId)
  save(cart.items.length > 0 ? cart : null)
  window.dispatchEvent(new Event('cart-updated'))
}

export function updateQuantity(productId: string, quantity: number) {
  const cart = load()
  if (!cart) return
  const item = cart.items.find((i) => i.productId === productId)
  if (!item) return
  if (quantity <= 0) {
    removeFromCart(productId)
    return
  }
  item.quantity = quantity
  save(cart)
  window.dispatchEvent(new Event('cart-updated'))
}

export function getItemCount(cart: Cart | null): number {
  return cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
}

export function getSubtotal(cart: Cart | null): number {
  return cart?.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) ?? 0
}
