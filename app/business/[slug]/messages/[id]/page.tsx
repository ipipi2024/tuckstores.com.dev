import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { sendBusinessMessage } from '../actions'
import AutoRefresh from '@/app/app/messages/AutoRefresh'
import MessageSendForm from '@/components/ui/MessageSendForm'

type Props = { params: Promise<{ slug: string; id: string }> }

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

export default async function BusinessThreadPage({ params }: Props) {
  const { slug, id } = await params
  const ctx = await getBusinessContext(slug)

  // Regular client — conversations RLS: is_business_member(business_id)
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, customer_user_id, status, business_id')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!conv) redirect(`/business/${slug}/messages`)

  // Mark any unread new_message notifications for this conversation as read.
  // RLS (auth.uid() = user_id) scopes this to the current business member automatically.
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'new_message')
    .filter('data->>conversation_id', 'eq', id)
    .is('read_at', null)

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


  // Admin client for customer name — users RLS: select own only
  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('users')
    .select('full_name, email')
    .eq('id', conv.customer_user_id)
    .single()

  const customerName = customer?.full_name ?? customer?.email ?? 'Customer'

  const sendAction = sendBusinessMessage.bind(null, slug, id)

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
    <div className="max-w-2xl">
      <AutoRefresh refreshOnMount />

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-1 border-b border-gray-100 dark:border-neutral-800">
        <Link
          href={`/business/${slug}/messages`}
          className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{customerName}</p>
          {conv.status !== 'open' && (
            <p className="text-xs text-gray-400 capitalize">{conv.status}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-1 py-3 min-h-48">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-8">
            No messages yet.
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
              const isMe = msg.sender_type === 'business_member'
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1`}
                >
                  <div
                    className={`max-w-[72%] px-3.5 py-2 text-sm leading-relaxed ${
                      isMe
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl rounded-br-sm'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 px-1">
                    {isMe ? 'You' : customerName} · {fmtTime(msg.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        <div id="thread-end" />
      </div>

      {/* Send form */}
      {conv.status === 'open' ? (
        <MessageSendForm action={sendAction} placeholder={`Reply to ${customerName}…`} variant="dark" />
      ) : (
        <p className="text-center text-xs text-gray-400 dark:text-neutral-500 pt-4 mt-2 border-t border-gray-100 dark:border-neutral-800">
          This conversation is {conv.status}.
        </p>
      )}
    </div>
  )
}
