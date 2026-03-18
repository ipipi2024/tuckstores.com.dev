import { NextResponse } from 'next/server'
import { getAuthUserOrNull } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUserOrNull()
  if (!user) return NextResponse.json({ activeOrders: 0, unreadMessages: 0 })

  const admin = createAdminClient()

  const [{ count: activeOrders }, convResult] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_user_id', user.id)
      .in('status', ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery']),
    admin
      .from('conversations')
      .select('updated_at, customer_last_read_at')
      .eq('customer_user_id', user.id)
      .limit(100),
  ])

  const unreadMessages = (convResult.data ?? []).filter(
    (c) => !c.customer_last_read_at || new Date(c.updated_at) > new Date(c.customer_last_read_at)
  ).length

  return NextResponse.json({ activeOrders: activeOrders ?? 0, unreadMessages })
}
