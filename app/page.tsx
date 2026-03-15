import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold">Tuck Stores</h1>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-5 py-2 rounded-md border text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}
