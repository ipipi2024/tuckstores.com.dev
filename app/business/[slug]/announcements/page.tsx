import { getBusinessContext } from '@/lib/auth/get-business-context'
import { createClient } from '@/lib/supabase/server'
import { canPerform } from '@/lib/auth/permissions'
import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { expireAnnouncement, deleteAnnouncement } from './actions'
import { ExpireForm, DeleteAnnouncementForm } from './AnnouncementRowActions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}

function deriveStatus(published_at: string | null, expires_at: string | null): {
  label: string
  style: string
} {
  const now = new Date()
  if (!published_at) {
    return { label: 'Draft', style: 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400' }
  }
  if (new Date(published_at) > now) {
    return { label: 'Scheduled', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  }
  if (expires_at && new Date(expires_at) <= now) {
    return { label: 'Expired', style: 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400' }
  }
  return { label: 'Live', style: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
}

function fmtDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const AUDIENCE_LABEL: Record<string, string> = {
  members:   'Members',
  customers: 'Customers',
  all:       'Everyone',
}

export default async function AnnouncementsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { success, error } = await searchParams
  const ctx = await getBusinessContext(slug)
  const canManage = canPerform(ctx.membership.role, 'manage_announcements')

  const supabase = await createClient()
  const { data } = await supabase
    .from('business_announcements')
    .select('id, title, body, audience_type, published_at, expires_at, created_at')
    .eq('business_id', ctx.business.id)
    .order('created_at', { ascending: false })
    .limit(100) // TODO: add pagination if businesses publish heavily

  const announcements = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Announcements</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canManage && (
          <Link
            href={`/business/${slug}/announcements/new`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shrink-0"
          >
            <Plus size={15} />
            New
          </Link>
        )}
      </div>

      {success && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5">
          Announcement published.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
          {decodeURIComponent(error)}
        </p>
      )}

      {announcements.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-10 text-center">
          <Megaphone size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet</p>
          {canManage && (
            <Link
              href={`/business/${slug}/announcements/new`}
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Plus size={14} />
              Create your first announcement
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const status = deriveStatus(a.published_at, a.expires_at)
            const expireAction = expireAnnouncement.bind(null, slug, a.id)
            const deleteAction = deleteAnnouncement.bind(null, slug, a.id)
            const isLive = status.label === 'Live'
            return (
              <div
                key={a.id}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${status.style}`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400 dark:text-neutral-500">
                  <span>Audience: <span className="text-gray-600 dark:text-gray-300">{AUDIENCE_LABEL[a.audience_type] ?? a.audience_type}</span></span>
                  {a.published_at && (
                    <span>Published: <span className="text-gray-600 dark:text-gray-300">{fmtDatetime(a.published_at)}</span></span>
                  )}
                  {a.expires_at && (
                    <span>Expires: <span className="text-gray-600 dark:text-gray-300">{fmtDatetime(a.expires_at)}</span></span>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-3 pt-1">
                    {isLive && <ExpireForm action={expireAction} />}
                    <DeleteAnnouncementForm action={deleteAction} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
