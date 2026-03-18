import { getBusinessContext, isSubscriptionActive } from '@/lib/auth/get-business-context'
import BusinessNav from '@/components/BusinessNav'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function BusinessLayout({ children, params }: Props) {
  const { slug } = await params

  // Validates auth + active membership. Redirects to /login or /business/select on failure.
  const ctx = await getBusinessContext(slug)

  // Subscription status banner
  let banner: { message: string; variant: 'warning' | 'error' } | null = null

  if (!ctx.subscription) {
    banner = {
      message: 'No active subscription. Go to Billing to activate your plan.',
      variant: 'warning',
    }
  } else if (ctx.subscription.status === 'past_due') {
    banner = {
      message: 'Your payment is past due. Update billing to restore full access.',
      variant: 'error',
    }
  } else if (ctx.business.status === 'suspended') {
    banner = {
      message: 'This business account has been suspended. Contact support.',
      variant: 'error',
    }
  } else if (isSubscriptionActive(ctx)) {
    const now = new Date()
    const endDate =
      ctx.subscription.trial_ends_at
        ? new Date(ctx.subscription.trial_ends_at)
        : ctx.subscription.expires_at
        ? new Date(ctx.subscription.expires_at)
        : null

    if (endDate) {
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 7 && daysLeft > 0) {
        const isTrialing = ctx.subscription.status === 'trialing'
        banner = {
          message: isTrialing
            ? `Free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Go to Billing to activate a plan.`
            : `Plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to avoid interruption.`,
          variant: 'warning',
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <BusinessNav
        slug={slug}
        businessName={ctx.business.name}
        role={ctx.membership.role}
      />

      <main className="lg:pl-56 pt-14 lg:pt-0 transition-all duration-300">
        {banner && (
          <div
            className={`px-4 py-2.5 text-sm text-center border-b ${
              banner.variant === 'error'
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
