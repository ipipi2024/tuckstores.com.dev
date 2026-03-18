import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, CheckCircle2, LogOut } from 'lucide-react'
import { updateProfile } from './actions'
import { signOut } from '@/app/auth/actions'
import SubmitButton from '@/components/ui/SubmitButton'
import AvatarEditor from '@/components/AvatarEditor'

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function ProfilePage({ searchParams }: Props) {
  const { error, success } = await searchParams
  const user = await getAuthUser()

  // Regular client — RLS allows users to read their own row
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, phone, email, avatar_url, avatar_path')
    .eq('id', user.id)
    .single()

  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
  const inputCls =
    'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 py-2">
        <AvatarEditor
          userId={user.id}
          initialAvatarUrl={profile?.avatar_url ?? null}
          displayName={profile?.full_name ?? null}
        />
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {profile?.full_name ?? 'My Profile'}
          </h2>
          <p className="text-sm text-gray-400 dark:text-neutral-500">{user.email}</p>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          Profile updated.
        </div>
      )}

      {/* Form */}
      <form action={updateProfile} className="space-y-4">
        <div>
          <label className={labelCls}>Full name</label>
          <input
            name="full_name"
            type="text"
            defaultValue={profile?.full_name ?? ''}
            placeholder="Your name"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ''}
            placeholder="+1 555 000 0000"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={profile?.email ?? user.email ?? ''}
            readOnly
            className={`${inputCls} opacity-60 cursor-not-allowed`}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
            Email cannot be changed from here.
          </p>
        </div>

        <SubmitButton
          pendingText="Saving…"
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          Save changes
        </SubmitButton>
      </form>

      {/* Sign out */}
      <div className="border-t border-gray-100 dark:border-neutral-800 pt-4">
        <form action={signOut}>
          <SubmitButton
            pendingText="Signing out…"
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <LogOut size={15} />
            Sign out
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
