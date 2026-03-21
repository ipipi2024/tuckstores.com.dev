import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function BusinessesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 h-12 flex items-center">
        <Link
          href="/app"
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
      </header>
      {children}
    </>
  )
}
