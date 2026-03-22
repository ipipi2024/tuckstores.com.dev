'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowUp } from 'lucide-react'
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
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${cls}`}
    >
      {pending ? <Spinner className="w-4 h-4" /> : <ArrowUp size={16} />}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleAction(formData: FormData) {
    await action(formData)
    formRef.current?.reset()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="pt-3 mt-2 border-t border-gray-100 dark:border-neutral-800"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          required
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none max-h-32 overflow-y-auto leading-relaxed py-0.5"
        />
        <SendButton variant={variant} />
      </div>
      <p className="text-xs text-gray-400 dark:text-neutral-600 text-center mt-1.5">
        Enter to send · Shift+Enter for new line
      </p>
    </form>
  )
}
