'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to new messages in a conversation via Supabase Realtime.
 * On any INSERT to conversation_messages for this conversation, triggers
 * a server re-render via router.refresh() to fetch and display the new message.
 * Renders nothing — drop this anywhere in a server component tree.
 */
export default function RealtimeMessages({ conversationId }: { conversationId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, router])

  return null
}
