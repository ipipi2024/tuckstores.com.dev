'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/get-user'
import { dispatchNotificationToBusinessMembers } from '@/lib/notifications'

/**
 * Find an existing conversation between this customer and the given business,
 * or create one, then redirect into the thread.
 * Called from the receipt detail "Contact business" button.
 */
export async function findOrCreateConversation(businessId: string, formData: FormData) {
  const user = await getAuthUser()
  const supabase = await createClient()

  // Verify the business exists and is active before creating a conversation.
  // Uses the public discovery RLS (status = 'active') — inactive businesses return null.
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .maybeSingle()

  if (!biz) {
    redirect(`/app/messages?error=${encodeURIComponent('Business not found')}`)
  }

  // RLS: auth.uid() = customer_user_id — safe to use regular client
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('business_id', businessId)
    .eq('customer_user_id', user.id)
    .maybeSingle()

  if (existing) {
    redirect(`/app/messages/${existing.id}`)
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ business_id: businessId, customer_user_id: user.id })
    .select('id')
    .single()

  if (error || !created) {
    redirect(`/app/messages?error=${encodeURIComponent('Could not start conversation')}`)
  }

  redirect(`/app/messages/${created.id}`)
}

/**
 * Send a text message as the authenticated customer.
 * Verifies conversation access via RLS before inserting.
 */
export async function sendCustomerMessage(conversationId: string, formData: FormData) {
  const user = await getAuthUser()
  const body = (formData.get('body') as string | null)?.trim()

  if (!body || body.length > 4000) redirect(`/app/messages/${conversationId}`)

  const supabase = await createClient()

  // Verify the conversation belongs to this customer (RLS enforces this)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, business_id')
    .eq('id', conversationId)
    .eq('customer_user_id', user.id)
    .maybeSingle()

  if (!conv) redirect('/app/messages')

  await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_user_id:  user.id,
      sender_type:     'customer',
      body,
    })

  // Push-only: messages use conversation read-tracking for badges, not notifications rows
  dispatchNotificationToBusinessMembers(conv.business_id, {
    type:  'new_message',
    title: 'New message from a customer',
    body:  body.length > 100 ? body.slice(0, 97) + '…' : body,
    data: {
      conversation_id: conversationId,
      business_id:     conv.business_id,
      url:             `/business/{slug}/messages/${conversationId}`,
    },
  }, { pushOnly: true }).catch(() => {})

  redirect(`/app/messages/${conversationId}`)
}
