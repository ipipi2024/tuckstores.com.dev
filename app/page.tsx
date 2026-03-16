import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
      <div className="text-center space-y-3 max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight">TuckStores</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          Point of sale &amp; inventory management for retail stores
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}
