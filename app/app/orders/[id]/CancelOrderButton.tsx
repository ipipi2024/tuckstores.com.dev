'use client'

import { useFormStatus } from 'react-dom'
import { cancelOrder } from '@/app/app/orders/actions'
import { Loader2, XCircle } from 'lucide-react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60 transition-colors"
    >
      {pending ? (
        <><Loader2 size={15} className="animate-spin" />Cancelling…</>
      ) : (
        <><XCircle size={15} />Cancel order</>
      )}
    </button>
  )
}

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const action = cancelOrder.bind(null, orderId)
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  )
}
