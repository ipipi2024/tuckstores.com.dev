'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import { dispatchNotification } from '@/lib/notifications'

/**
 * Send a text message as a business member.
 * Verifies conversation belongs to this business before inserting.
 */
export async function sendBusinessMessage(
  slug: string,
  conversationId: string,
  formData: FormData,
) {
  const ctx = await getBusinessContext(slug)
  if (!isSubscriptionActive(ctx)) {
    redirect(`/business/${slug}/messages?error=Subscription+is+not+active`)
  }

  const body = (formData.get('body') as string | null)?.trim()

  const threadPath = `/business/${slug}/messages/${conversationId}`
  if (!body) redirect(threadPath)
  if (body.length > 4000) redirect(threadPath)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify conversation belongs to this business (RLS: is_business_member(business_id))
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, customer_user_id')
    .eq('id', conversationId)
    .eq('business_id', ctx.business.id)
    .maybeSingle()

  if (!conv) redirect(`/business/${slug}/messages`)

  await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_user_id:  user.id,
      sender_type:     'business_member',
      body,
    })

  // Notify the customer — fire-and-forget, never blocks the redirect
  if (conv.customer_user_id) {
    dispatchNotification({
      userId: conv.customer_user_id,
      type:   'new_message',
      title:  `New message from ${ctx.business.name}`,
      body:   body.length > 100 ? body.slice(0, 97) + '…' : body,
      data: {
        conversation_id: conversationId,
        business_id:     ctx.business.id,
        url:             `/app/messages/${conversationId}`,
      },
    }).catch(() => {})
  }

  redirect(threadPath)
}
