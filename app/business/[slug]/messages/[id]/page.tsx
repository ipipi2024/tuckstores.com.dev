import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { sendBusinessMessage } from '../actions'
import AutoRefresh from '@/app/app/messages/AutoRefresh'
import MessageSendForm from '@/components/ui/MessageSendForm'
import ScrollToBottom from '@/components/ui/ScrollToBottom'

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

  const supabase = await createClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, customer_user_id, status, business_id')
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!conv) redirect(`/business/${slug}/messages`)

  await supabase
    .from('conversations')
    .update({ business_last_read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.business.id)

  const { data: msgs } = await supabase
    .from('conversation_messages')
    .select('id, body, sender_type, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(150)

  const messages = (msgs ?? []).reverse()

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('users')
    .select('full_name, email, avatar_url')
    .eq('id', conv.customer_user_id)
    .single()

  const customerName = customer?.full_name ?? customer?.email ?? 'Customer'
  const avatarUrl = customer?.avatar_url ?? null

  const sendAction = sendBusinessMessage.bind(null, slug, id)

  // Group messages by day
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
    <div className="max-w-2xl flex flex-col min-h-[calc(100dvh-8rem)]">
      <AutoRefresh refreshOnMount />
      <ScrollToBottom />

      {/* Header */}
      <div className="flex items-center gap-3 pb-3 mb-2 border-b border-gray-100 dark:border-neutral-800">
        <Link
          href={`/business/${slug}/messages`}
          className="shrink-0 p-1 -ml-1 text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>

        {/* Customer avatar */}
        <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-neutral-300">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={customerName} width={36} height={36} className="w-full h-full object-cover" />
          ) : (
            customerName.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{customerName}</p>
          {conv.status !== 'open' && (
            <p className="text-xs text-gray-400 dark:text-neutral-500 capitalize">{conv.status}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-12">
            No messages yet.
          </p>
        )}

        {grouped.map(({ day, messages: dayMsgs }) => (
          <div key={day}>
            {/* Day separator */}
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
              <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0 px-1">{day}</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
            </div>

            <div className="space-y-0.5">
              {dayMsgs.map((msg, i) => {
                const isMe = msg.sender_type === 'business_member'
                const nextMsg = dayMsgs[i + 1]
                const isLastInRun = !nextMsg || nextMsg.sender_type !== msg.sender_type

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'} ${isLastInRun ? 'mb-3' : 'mb-0.5'}`}
                  >
                    {/* Customer avatar (left side) */}
                    {!isMe && (
                      <div className="shrink-0 w-7 h-7 mb-0.5">
                        {isLastInRun && (
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-neutral-300">
                            {avatarUrl ? (
                              <Image src={avatarUrl} alt={customerName} width={28} height={28} className="w-full h-full object-cover" />
                            ) : (
                              customerName.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMe
                            ? `bg-gray-900 dark:bg-white text-white dark:text-gray-900 ${isLastInRun ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'}`
                            : `bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 text-gray-900 dark:text-white ${isLastInRun ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
                        }`}
                      >
                        {msg.body}
                      </div>
                      {isLastInRun && (
                        <span className="text-xs text-gray-400 dark:text-neutral-500 px-1">
                          {fmtTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
