import ThemeToggle from '@/components/ThemeToggle'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-8">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  )
}
