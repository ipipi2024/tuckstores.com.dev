'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { revokeInvitation } from './actions'
import Spinner from '@/components/ui/Spinner'

type Props = { slug: string; invitationId: string }

export default function InvitationActions({ slug, invitationId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    if (!window.confirm('Revoke this invitation?')) return
    setBusy(true)
    setError(null)
    const result = await revokeInvitation(slug, invitationId)
    setBusy(false)
    if ('error' in result) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
      <button
        onClick={handleRevoke}
        disabled={busy}
        className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
      >
        {busy && <Spinner className="w-3 h-3" />}
        {busy ? 'Revoking…' : 'Revoke'}
      </button>
    </div>
  )
}
