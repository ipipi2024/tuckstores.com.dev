import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = user.email === process.env.ADMIN_EMAIL
  let expiryBanner: string | null = null

  if (!isAdmin) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('expires_at')
      .eq('user_id', user.id)
      .single()

    const now = new Date()

    if (!sub || new Date(sub.expires_at) < now) {
      redirect('/subscribe')
    }

    const daysLeft = Math.ceil(
      (new Date(sub.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft <= 7) {
      expiryBanner = `Your plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Contact your provider to renew.`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <Navbar />
      <main className="lg:pl-56 pt-14 lg:pt-0 transition-all duration-300">
        {expiryBanner && (
          <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 text-center">
            {expiryBanner}
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
