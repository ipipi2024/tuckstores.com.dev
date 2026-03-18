import { getBusinessContext } from '@/lib/auth/get-business-context'
import { canPerform } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

export default async function SalesPage({ params }: Props) {
  const { slug } = await params
  const ctx = await getBusinessContext(slug)

  if (!canPerform(ctx.membership.role, 'view_sales')) {
    redirect(`/business/${slug}/dashboard`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
        <TrendingUp size={28} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sales history will appear here once POS is live.
        </p>
      </div>
    </div>
  )
}
