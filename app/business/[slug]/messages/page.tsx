import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import AutoRefresh from '@/app/app/messages/AutoRefresh'

type Props = { params: Promise<{ slug: string }> }

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

export default async function BusinessMessagesPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  // Regular client — conversations RLS: is_business_member(business_id)
  const supabase = await createClient()
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, customer_user_id, status, updated_at, business_last_read_at')
    .eq('business_id', ctx.business.id)
    .order('updated_at', { ascending: false })
    .limit(100) // TODO: paginate for high-volume businesses

  const allConvs = convs ?? []
  const convIds = allConvs.map((c) => c.id)

  // Admin client for customer names and last message previews — users RLS: select
  // own only, and we need SECURITY DEFINER RPC for efficient previews.
  const customerMap: Record<string, { name: string; email: string; avatar_url: string | null }> = {}
  const lastMsgMap: Record<string, LastMsg> = {}

  if (convIds.length > 0) {
    const admin = createAdminClient()
    const customerIds = [...new Set(allConvs.map((c) => c.customer_user_id))]

    const [{ data: users }, { data: lastMsgs }] = await Promise.all([
      admin.from('users').select('id, full_name, email, avatar_url').in('id', customerIds),
      admin.rpc('get_last_messages_for_conversations', { conv_ids: convIds }),
    ])

    for (const u of users ?? []) {
      customerMap[u.id] = { name: u.full_name ?? u.email ?? 'Unknown', email: u.email, avatar_url: u.avatar_url ?? null }
    }
    for (const m of (lastMsgs ?? []) as LastMsg[]) lastMsgMap[m.conversation_id] = m
  }

  return (
    <div className="space-y-4">
      <AutoRefresh refreshOnMount />
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {allConvs.length} conversation{allConvs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {allConvs.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <MessageSquare size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">
            Conversations start when a customer contacts you from their receipt.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {allConvs.map((conv) => {
            const unread =
              !conv.business_last_read_at ||
              new Date(conv.updated_at) > new Date(conv.business_last_read_at)

            const lastMsg = lastMsgMap[conv.id]
            const preview = lastMsg
              ? truncate(lastMsg.sender_type === 'business_member' ? `You: ${lastMsg.body}` : lastMsg.body)
              : null

            const customer = customerMap[conv.customer_user_id]
            const displayName = customer?.name ?? 'Unknown customer'
            const avatarUrl = customer?.avatar_url ?? null

            return (
              <Link
                key={conv.id}
                href={`/business/${slug}/messages/${conv.id}`}
                className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className={`shrink-0 w-11 h-11 rounded-full overflow-hidden ${!avatarUrl ? 'bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-neutral-300' : ''} ${unread ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-indigo-400 dark:ring-offset-neutral-900' : ''}`}>
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={displayName} width={44} height={44} className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${unread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-neutral-300'}`}>
                      {displayName}
                    </p>
                    {conv.status !== 'open' && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 capitalize">
                        {conv.status}
                      </span>
                    )}
                  </div>
                  {preview ? (
                    <p className={`text-xs truncate mt-0.5 ${unread ? 'font-medium text-gray-700 dark:text-neutral-200' : 'text-gray-400 dark:text-neutral-500'}`}>
                      {preview}
                    </p>
                  ) : customer?.email ? (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{customer.email}</p>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`text-xs tabular-nums ${unread ? 'font-medium text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-neutral-500'}`}>
                    {fmtTime(conv.updated_at)}
                  </span>
                  {unread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
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
