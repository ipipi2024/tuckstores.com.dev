import { getAuthUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { sendCustomerMessage } from '../actions'
import AutoRefresh from '../AutoRefresh'
import MessageSendForm from '@/components/ui/MessageSendForm'

type Props = { params: Promise<{ id: string }> }

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export default async function CustomerThreadPage({ params }: Props) {
  const { id } = await params
  const user = await getAuthUser()

  // Regular client — conversations RLS: auth.uid() = customer_user_id
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, business_id, status, customer_user_id')
    .eq('id', id)
    .eq('customer_user_id', user.id)
    .maybeSingle()

  if (!conv) redirect('/app/messages')

  // Regular client — conversation_messages RLS: via conversation access
  // Limit to most recent 150 messages. TODO: add older-message paging for long threads.
  const { data: msgs } = await supabase
    .from('conversation_messages')
    .select('id, body, sender_type, sender_user_id, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(150)

  // Reverse so the thread renders chronologically (oldest first)
  const messages = (msgs ?? []).reverse()


  // Admin client for business name — businesses RLS blocks non-members
  const admin = createAdminClient()
  const { data: biz } = await admin
    .from('businesses')
    .select('name')
    .eq('id', conv.business_id)
    .single()

  const bizName = biz?.name ?? 'Business'

  const sendAction = sendCustomerMessage.bind(null, id)

  // Group messages by day for date separators
  const grouped: { day: string; messages: typeof messages }[] = []
  for (const msg of messages) {
    const day = fmtDay(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.day === day) {
      last.messages.push(msg)
    } else {
      grouped.push({ day, messages: [msg] })
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-8rem)]">
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-1 border-b border-gray-100 dark:border-neutral-800">
        <Link
          href="/app/messages"
          className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{bizName}</p>
          {conv.status !== 'open' && (
            <p className="text-xs text-gray-400 capitalize">{conv.status}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-8">
            No messages yet. Say hello!
          </p>
        )}

        {grouped.map(({ day, messages: dayMsgs }) => (
          <div key={day} className="space-y-1">
            {/* Day separator */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
              <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">{day}</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
            </div>

            {dayMsgs.map((msg) => {
              const isMe = msg.sender_type === 'customer'
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1`}
                >
                  <div
                    className={`max-w-[78%] px-3.5 py-2 text-sm leading-relaxed ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm'
                        : 'bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 px-1">
                    {isMe ? 'You' : bizName} · {fmtTime(msg.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        {/* Scroll anchor */}
        <div id="thread-end" />
      </div>

      {/* Send form */}
      {conv.status === 'open' ? (
        <MessageSendForm action={sendAction} placeholder="Message…" variant="indigo" />
      ) : (
        <p className="text-center text-xs text-gray-400 dark:text-neutral-500 pt-3 mt-2 border-t border-gray-100 dark:border-neutral-800">
          This conversation is {conv.status}.
        </p>
      )}
    </div>
  )
}
