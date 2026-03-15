import Navbar from '@/components/Navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <Navbar />
      {/* sidebar offset on desktop, top+bottom bar offset on mobile */}
      <main className="lg:pl-56 pt-14 lg:pt-0 transition-all duration-300">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
