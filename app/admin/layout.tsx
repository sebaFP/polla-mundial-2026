import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [adminUser] = await db.select({ inscriptionStatus: users.inscriptionStatus })
    .from(users).where(eq(users.id, session.userId))
  const isParticipant = adminUser?.inscriptionStatus === 'approved'

  return (
    <div className="min-h-screen gradient-bg">
      <AdminNav userName={session.name} isParticipant={isParticipant} />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {children}
      </main>
    </div>
  )
}
