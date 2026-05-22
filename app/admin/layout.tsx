import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen gradient-bg">
      <AdminNav userName={session.name} />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {children}
      </main>
    </div>
  )
}
