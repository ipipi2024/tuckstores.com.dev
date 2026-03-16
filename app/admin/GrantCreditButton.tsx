'use client'

import { useFormStatus } from 'react-dom'

export function GrantCreditButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-md hover:opacity-75 transition-opacity whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
    >
      {pending && (
        <svg
          className="animate-spin h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {pending ? 'Saving…' : '+30 days'}
    </button>
  )
}
