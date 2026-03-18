'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMemberRole, suspendMembership, reactivateMembership } from './actions'
import type { MembershipRole } from '@/lib/auth/permissions'
import Spinner from '@/components/ui/Spinner'

type Props = {
  slug: string
  membershipId: string
  currentRole: MembershipRole
  currentStatus: string
  isSelf: boolean
  isProtectedOwner: boolean
  assignableRoles: Array<{ value: MembershipRole; label: string }>
}

export default function MemberActions({
  slug,
  membershipId,
  currentRole,
  currentStatus,
  isSelf,
  isProtectedOwner,
  assignableRoles,
}: Props) {
  const router = useRouter()
  const [role, setRole] = useState<MembershipRole>(currentRole)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Self or protected owner → no controls
  if (isSelf) return <span className="text-xs text-gray-400 dark:text-neutral-500">You</span>
  if (isProtectedOwner) return <span className="text-xs text-gray-400 dark:text-neutral-500">Last owner</span>

  async function handleRoleChange(newRole: MembershipRole) {
    if (newRole === currentRole) return
    setRole(newRole)
    setBusy(true)
    setError(null)
    const result = await updateMemberRole(slug, membershipId, newRole)
    setBusy(false)
    if ('error' in result) {
      setRole(currentRole)
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  async function handleSuspend() {
    if (!window.confirm('Suspend this member? They will lose access immediately.')) return
    setBusy(true)
    setError(null)
    const result = await suspendMembership(slug, membershipId)
    setBusy(false)
    if ('error' in result) setError(result.error)
    else router.refresh()
  }

  async function handleReactivate() {
    setBusy(true)
    setError(null)
    const result = await reactivateMembership(slug, membershipId)
    setBusy(false)
    if ('error' in result) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {busy && <Spinner className="w-3 h-3 text-gray-400" />}
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}

      {/* Role select */}
      <select
        value={role}
        disabled={busy}
        onChange={(e) => handleRoleChange(e.target.value as MembershipRole)}
        className="text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      >
        {assignableRoles.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {/* Suspend / Reactivate */}
      {currentStatus === 'active' ? (
        <button
          onClick={handleSuspend}
          disabled={busy}
          className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
        >
          Suspend
        </button>
      ) : currentStatus === 'suspended' ? (
        <button
          onClick={handleReactivate}
          disabled={busy}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
        >
          Reactivate
        </button>
      ) : null}
    </div>
  )
}
