import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { Megaphone } from 'lucide-react'

function fmtRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function CustomerAnnouncementsPage() {
  const user = await getAuthUser()
  const supabase = await createClient()

  // Relationship rule: businesses this user has sales or conversations with
  const [salesRes, convsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('business_id')
      .eq('customer_user_id', user.id),
    supabase
      .from('conversations')
      .select('business_id')
      .eq('customer_user_id', user.id),
  ])

  const relatedIds = [
    ...new Set([
      ...(salesRes.data ?? []).map((r) => r.business_id),
      ...(convsRes.data ?? []).map((r) => r.business_id),
    ]),
  ]

  if (relatedIds.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Updates</h1>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <Megaphone size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No updates yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
            Announcements from businesses you&apos;ve purchased from will appear here.
          </p>
        </div>
      </div>
    )
  }

  // Fetch published, non-expired announcements from related businesses.
  // The RLS policy for "select published for authenticated" ensures only
  // audience_type in ('customers','all') with published_at <= now() is visible.
  const { data } = await supabase
    .from('business_announcements')
    .select(`
      id, title, body, audience_type, published_at, expires_at,
      businesses ( id, name, slug )
    `)
    .in('business_id', relatedIds)
    .order('published_at', { ascending: false })

  const announcements = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Updates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            From businesses you&apos;ve visited
          </p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <Megaphone size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const biz = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses
            const isExpired = a.expires_at ? new Date(a.expires_at) <= new Date() : false
            return (
              <div
                key={a.id}
                className={`bg-white dark:bg-neutral-900 border rounded-xl px-5 py-4 space-y-2 ${
                  isExpired
                    ? 'border-gray-100 dark:border-neutral-800 opacity-60'
                    : 'border-gray-200 dark:border-neutral-800'
                }`}
              >
                {/* Business + date */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                      {biz?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                      {biz?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isExpired && (
                      <span className="text-xs text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                        Expired
                      </span>
                    )}
                    {a.published_at && (
                      <span className="text-xs text-gray-400 dark:text-neutral-500">
                        {fmtRelative(a.published_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {a.body}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
