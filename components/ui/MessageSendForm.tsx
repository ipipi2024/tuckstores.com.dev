'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Send } from 'lucide-react'
import Spinner from './Spinner'

function SendButton({ variant }: { variant?: 'indigo' | 'dark' }) {
  const { pending } = useFormStatus()
  const cls =
    variant === 'indigo'
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
      : 'bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900'

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Send"
      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors disabled:opacity-60 ${cls}`}
    >
      {pending ? <Spinner className="w-4 h-4" /> : <Send size={16} />}
    </button>
  )
}

interface Props {
  action: (formData: FormData) => Promise<void>
  placeholder?: string
  variant?: 'indigo' | 'dark'
}

export default function MessageSendForm({ action, placeholder = 'Message…', variant }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  // Clear textarea after successful submit (server action redirects/refreshes)
  async function handleAction(formData: FormData) {
    await action(formData)
    formRef.current?.reset()
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex items-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-neutral-800"
    >
      <textarea
        name="body"
        rows={1}
        required
        placeholder={placeholder}
        className="flex-1 resize-none px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-28 overflow-auto"
      />
      <SendButton variant={variant} />
    </form>
  )
}
