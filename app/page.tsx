import Link from 'next/link'
import {
  ShoppingCart,
  BarChart2,
  Boxes,
  Users,
  TrendingUp,
  PackagePlus,
  CheckCircle,
} from 'lucide-react'

const features = [
  {
    icon: ShoppingCart,
    title: 'Point of Sale',
    description: 'Fast checkout with product search, quantity controls, and instant receipt generation.',
  },
  {
    icon: Boxes,
    title: 'Inventory Tracking',
    description: 'Monitor stock levels in real time. Get alerts before products run out.',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    description: 'Visualise revenue trends, top-selling products, and sales performance over time.',
  },
  {
    icon: TrendingUp,
    title: 'Sales History',
    description: 'Browse every transaction, filter by date, and review what was sold and when.',
  },
  {
    icon: PackagePlus,
    title: 'Purchase Orders',
    description: 'Record stock purchases from suppliers and keep your costs accurate.',
  },
  {
    icon: Users,
    title: 'Customers & Suppliers',
    description: 'Maintain a directory of your customers and suppliers for faster operations.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Add your products',
    description: 'Create your product catalogue with prices and stock quantities in minutes.',
  },
  {
    number: '02',
    title: 'Start selling',
    description: 'Use the POS screen to ring up sales quickly — search, add, and complete checkout.',
  },
  {
    number: '03',
    title: 'Track your business',
    description: 'Watch your dashboard update in real time. Spot trends and restock before you run out.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-white">

      {/* Nav */}
      <header className="border-b border-gray-100 dark:border-neutral-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-bold text-lg tracking-tight">TuckStores</span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-3 py-1.5 rounded-full mb-6">
          <CheckCircle size={12} />
          Built for retail tuck shops &amp; small stores
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
          Run your store.<br />Know your numbers.
        </h1>
        <p className="mt-5 text-lg text-gray-500 dark:text-neutral-400 max-w-xl mx-auto">
          TuckStores gives you a simple point of sale, live inventory tracking, and business analytics — all in one place.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-gray-50 dark:bg-neutral-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Everything you need</h2>
            <p className="mt-2 text-gray-500 dark:text-neutral-400">
              All the tools to manage a retail store, without the complexity.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl p-5 space-y-3"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                  <Icon size={18} className="text-gray-700 dark:text-neutral-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-2 text-gray-500 dark:text-neutral-400">Up and running in under 10 minutes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map(({ number, title, description }) => (
              <div key={number} className="text-center space-y-3">
                <span className="text-4xl font-bold text-gray-100 dark:text-neutral-800">{number}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-6 py-16 bg-black dark:bg-white">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold text-white dark:text-black">Ready to get started?</h2>
          <p className="text-gray-400 dark:text-neutral-600 text-sm">
            Create your account and start managing your store today.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-2 px-6 py-3 rounded-lg bg-white dark:bg-black text-black dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-100 dark:border-neutral-800 text-center">
        <p className="text-xs text-gray-400 dark:text-neutral-500">
          &copy; {new Date().getFullYear()} TuckStores. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
