import { redirect } from 'next/navigation'

// /business/[slug] → redirect to dashboard
export default async function BusinessIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/business/${slug}/dashboard`)
}
