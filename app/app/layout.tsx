import { getAuthUser } from '@/lib/auth/get-user'
import AppNav from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Redirect to /login if not authenticated
  await getAuthUser()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 pb-20">
      <header className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 h-12 flex items-center">
        <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
          TuckStores
        </span>
      </header>
      <main className="max-w-lg mx-auto px-4 py-5">
        {children}
      </main>
      <AppNav />
    </div>
  )
}
