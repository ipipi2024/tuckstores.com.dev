import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform, ROLE_LEVEL, type MembershipRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { createInvitation } from '../actions'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import SubmitButton from '@/components/ui/SubmitButton'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}

const ALL_ROLES: Array<{ value: MembershipRole; label: string; description: string }> = [
  { value: 'owner',           label: 'Owner',           description: 'Full access including billing and ownership transfer' },
  { value: 'admin',           label: 'Admin',           description: 'Full access except billing and ownership' },
  { value: 'manager',         label: 'Manager',         description: 'Manage products, suppliers, purchases, inventory, and sales' },
  { value: 'cashier',         label: 'Cashier',         description: 'Create sales via POS and view products' },
  { value: 'inventory_clerk', label: 'Inventory Clerk', description: 'Record purchases and view inventory' },
  { value: 'staff',           label: 'Staff',           description: 'Read-only access to products, sales, and inventory' },
]

export default async function InviteStaffPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { error } = await searchParams
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'manage_staff')) {
    redirect(`/business/${slug}/staff`)
  }

  // Build assignable roles: owner can assign any, admin can only assign strictly lower
  const assignableRoles = ALL_ROLES.filter(
    (r) => ctx.membership.role === 'owner' || ROLE_LEVEL[r.value] < ROLE_LEVEL[ctx.membership.role]
  )

  const action = createInvitation.bind(null, slug)

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link
          href={`/business/${slug}/staff`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={14} />
          Back to Staff
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invite Staff Member</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          An invitation link will be generated that you can share manually.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={action} className="space-y-5">
        <div>
          <label className={labelCls}>Email address <span className="text-red-500">*</span></label>
          <input
            name="email"
            type="email"
            required
            autoFocus
            placeholder="colleague@example.com"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Role <span className="text-red-500">*</span></label>
          <div className="space-y-2">
            {assignableRoles.map((r) => (
              <label key={r.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  defaultChecked={r.value === 'staff'}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{r.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <SubmitButton
            pendingText="Generating…"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            Generate invitation
          </SubmitButton>
          <Link
            href={`/business/${slug}/staff`}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
