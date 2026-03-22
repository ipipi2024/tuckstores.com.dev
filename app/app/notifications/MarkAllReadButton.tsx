'use client'

import { useTransition } from 'react'
import { CheckCheck } from 'lucide-react'
import { useNotifications } from '@/components/NotificationProvider'
import { markAllCustomerNotificationsSeen } from './actions'
import { useRouter } from 'next/navigation'

export default function MarkAllReadButton() {
  const [pending, startTransition] = useTransition()
  const { resetUnread } = useNotifications()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      resetUnread()                          // immediate — badge clears at once
      await markAllCustomerNotificationsSeen() // persists to DB, clears orders badge, revalidates layout
      router.refresh()                 // re-renders the list so rows show as read
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
    >
      <CheckCheck size={13} />
      {pending ? 'Marking…' : 'Mark all read'}
    </button>
  )
}
