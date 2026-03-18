'use client'

import { useFormStatus } from 'react-dom'
import Spinner from './Spinner'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string
}

/**
 * A submit button that automatically shows a loading spinner and pending text
 * while the parent <form> server action is in flight. Must be a direct or indirect
 * child of a <form> element.
 */
export default function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  ...props
}: Props) {
  const { pending } = useFormStatus()
  const isDisabled = pending || disabled

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={className}
      aria-disabled={isDisabled}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner className="w-3.5 h-3.5" />
          {pendingText ?? 'Loading…'}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
