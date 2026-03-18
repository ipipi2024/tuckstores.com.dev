'use client'

import { useFormStatus } from 'react-dom'
import Spinner from '@/components/ui/Spinner'

function ExpireButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
    >
      {pending && <Spinner className="w-3 h-3" />}
      {pending ? 'Expiring…' : 'Expire now'}
    </button>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
    >
      {pending && <Spinner className="w-3 h-3" />}
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}

export function ExpireForm({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <ExpireButton />
    </form>
  )
}

export function DeleteAnnouncementForm({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <DeleteButton />
    </form>
  )
}
