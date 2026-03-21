import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import AutoRefresh from '@/app/app/messages/AutoRefresh'

type Props = { params: Promise<{ slug: string }> }

function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function BusinessMessagesPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  // Regular client — conversations RLS: is_business_member(business_id)
  const supabase = await createClient()
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, customer_user_id, status, updated_at')
    .eq('business_id', ctx.business.id)
    .order('updated_at', { ascending: false })
    .limit(100) // TODO: paginate for high-volume businesses

  const allConvs = convs ?? []

  // Admin client for customer names — users RLS: select own only
  const customerMap: Record<string, { name: string; email: string }> = {}
  const customerIds = [...new Set(allConvs.map((c) => c.customer_user_id))]
  if (customerIds.length > 0) {
    const admin = createAdminClient()
    const { data: users } = await admin
      .from('users')
      .select('id, full_name, email')
      .in('id', customerIds)
    for (const u of users ?? []) {
      customerMap[u.id] = { name: u.full_name ?? u.email ?? 'Unknown', email: u.email }
    }
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
            const customer = customerMap[conv.customer_user_id]
            return (
              <Link
                key={conv.id}
                href={`/business/${slug}/messages/${conv.id}`}
                className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-neutral-300">
                  {(customer?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {customer?.name ?? 'Unknown customer'}
                  </p>
                  {customer?.email && (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{customer.email}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400 dark:text-neutral-500">
                    {fmtTime(conv.updated_at)}
                  </span>
                  {conv.status !== 'open' && (
                    <span className="text-xs text-gray-400 dark:text-neutral-500 capitalize">
                      {conv.status}
                    </span>
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
