import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessageSquare, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type Props = { searchParams: Promise<{ error?: string }> }

function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function CustomerMessagesPage({ searchParams }: Props) {
  const { error } = await searchParams
  const user = await getAuthUser()

  // Regular client — RLS: auth.uid() = customer_user_id on conversations
  const supabase = await createClient()
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, business_id, status, updated_at')
    .eq('customer_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100) // TODO: paginate if a customer accumulates many conversations

  const allConvs = convs ?? []

  // Admin client for business names — businesses RLS blocks non-members
  const bizMap: Record<string, string> = {}
  const bizIds = [...new Set(allConvs.map((c) => c.business_id))]
  if (bizIds.length > 0) {
    const admin = createAdminClient()
    const { data: bizRows } = await admin
      .from('businesses')
      .select('id, name')
      .in('id', bizIds)
    for (const b of bizRows ?? []) bizMap[b.id] = b.name
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare size={18} />
          Messages
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {allConvs.length} conversation{allConvs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {allConvs.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-10 text-center">
          <MessageSquare size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
            Start a conversation from a receipt by tapping &ldquo;Contact business&rdquo;.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {allConvs.map((conv) => (
            <Link
              key={conv.id}
              href={`/app/messages/${conv.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {(bizMap[conv.business_id] ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {bizMap[conv.business_id] ?? 'Unknown business'}
                </p>
                {conv.status !== 'open' && (
                  <p className="text-xs text-gray-400 dark:text-neutral-500 capitalize">{conv.status}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-gray-400 dark:text-neutral-500">
                {fmtTime(conv.updated_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
