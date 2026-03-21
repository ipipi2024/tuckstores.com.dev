import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessageSquare, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import AutoRefresh from '@/app/app/messages/AutoRefresh'

type Props = { searchParams: Promise<{ error?: string }> }

type LastMsg = { conversation_id: string; body: string; sender_type: string }

function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export default async function CustomerMessagesPage({ searchParams }: Props) {
  const { error } = await searchParams
  const user = await getAuthUser()

  // Regular client — RLS: auth.uid() = customer_user_id on conversations
  const supabase = await createClient()
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, business_id, status, updated_at, customer_last_read_at')
    .eq('customer_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100) // TODO: paginate if a customer accumulates many conversations

  const allConvs = convs ?? []
  const convIds = allConvs.map((c) => c.id)

  // Admin client for business names and last message previews — businesses RLS
  // blocks non-members, and we need SECURITY DEFINER RPC for efficient previews.
  const bizMap: Record<string, string> = {}
  const lastMsgMap: Record<string, LastMsg> = {}

  if (convIds.length > 0) {
    const admin = createAdminClient()
    const bizIds = [...new Set(allConvs.map((c) => c.business_id))]

    const [{ data: bizRows }, { data: lastMsgs }] = await Promise.all([
      admin.from('businesses').select('id, name').in('id', bizIds),
      admin.rpc('get_last_messages_for_conversations', { conv_ids: convIds }),
    ])

    for (const b of bizRows ?? []) bizMap[b.id] = b.name
    for (const m of (lastMsgs ?? []) as LastMsg[]) lastMsgMap[m.conversation_id] = m
  }

  return (
    <div className="space-y-4">
      <AutoRefresh refreshOnMount />
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
          {allConvs.map((conv) => {
            const unread =
              !conv.customer_last_read_at ||
              new Date(conv.updated_at) > new Date(conv.customer_last_read_at)

            const lastMsg = lastMsgMap[conv.id]
            const preview = lastMsg
              ? truncate(lastMsg.sender_type === 'customer' ? `You: ${lastMsg.body}` : lastMsg.body)
              : null

            const bizName = bizMap[conv.business_id] ?? 'Unknown business'

            return (
              <Link
                key={conv.id}
                href={`/app/messages/${conv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {bizName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${unread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                    {bizName}
                  </p>
                  {preview ? (
                    <p className={`text-xs truncate ${unread ? 'font-medium text-gray-800 dark:text-neutral-200' : 'text-gray-400 dark:text-neutral-500'}`}>
                      {preview}
                    </p>
                  ) : conv.status !== 'open' ? (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 capitalize">{conv.status}</p>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-xs ${unread ? 'font-medium text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-neutral-500'}`}>
                    {fmtTime(conv.updated_at)}
                  </span>
                  {unread && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
