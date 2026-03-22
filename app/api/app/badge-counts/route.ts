import { NextResponse } from 'next/server'
import { getAuthUserOrNull } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUserOrNull()
  if (!user) return NextResponse.json({ activeOrders: 0, unreadMessages: 0 })

  const admin = createAdminClient()

  const [{ data: unseenOrders }, convResult] = await Promise.all([
    admin.rpc('count_customer_unseen_orders', { p_user_id: user.id }),
    admin
      .from('conversations')
      .select('updated_at, customer_last_read_at')
      .eq('customer_user_id', user.id)
      .limit(100),
  ])

  const unreadMessages = (convResult.data ?? []).filter(
    (c) => !c.customer_last_read_at || new Date(c.updated_at) > new Date(c.customer_last_read_at)
  ).length

  return NextResponse.json({ activeOrders: unseenOrders ?? 0, unreadMessages })
}
