/**
 * Validates a `next` redirect param.
 * Must be a relative path (starts with "/") and must not be a protocol-relative
 * URL ("//evil.com"). Returns null if the value is absent or unsafe.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next
}
