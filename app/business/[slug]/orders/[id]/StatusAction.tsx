'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

const ACTION_LABEL: Record<string, string> = {
  accepted:         'Accept order',
  rejected:         'Reject order',
  preparing:        'Mark preparing',
  ready:            'Mark ready',
  out_for_delivery: 'Out for delivery',
  completed:        'Mark complete',
  cancelled:        'Cancel order',
}

const ACTION_STYLE: Record<string, string> = {
  accepted:         'bg-blue-600 hover:bg-blue-700 text-white',
  rejected:         'bg-red-600 hover:bg-red-700 text-white',
  preparing:        'bg-indigo-600 hover:bg-indigo-700 text-white',
  ready:            'bg-teal-600 hover:bg-teal-700 text-white',
  out_for_delivery: 'bg-purple-600 hover:bg-purple-700 text-white',
  completed:        'bg-green-600 hover:bg-green-700 text-white',
  cancelled:        'border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800',
}

const DESTRUCTIVE = new Set(['rejected', 'cancelled'])

function SubmitButton({ status }: { status: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${ACTION_STYLE[status] ?? ACTION_STYLE.cancelled}`}
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {ACTION_LABEL[status] ?? status}
    </button>
  )
}

type Props = {
  action: (formData: FormData) => Promise<void>
  status: string
  showNoteField?: boolean
}

export default function StatusAction({ action, status, showNoteField = false }: Props) {
  // Destructive actions with an optional note get a card wrapper for clarity
  if (showNoteField && DESTRUCTIVE.has(status)) {
    return (
      <form action={action} className="w-full space-y-2">
        <input type="hidden" name="status" value={status} />
        <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-neutral-400">
            {status === 'rejected' ? 'Rejection note' : 'Cancellation note'}
            <span className="ml-1 font-normal text-gray-400 dark:text-neutral-500">(optional)</span>
          </p>
          <textarea
            name="business_note"
            rows={2}
            placeholder={
              status === 'rejected'
                ? 'Reason for rejection (shown to customer)…'
                : 'Reason for cancellation (shown to customer)…'
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex justify-end">
            <SubmitButton status={status} />
          </div>
        </div>
      </form>
    )
  }

  return (
    <form action={action} className="contents">
      <input type="hidden" name="status" value={status} />
      <SubmitButton status={status} />
    </form>
  )
}
