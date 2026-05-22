import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AdminsManager from '@/components/admin/AdminsManager'

export const revalidate = 0

export default async function AdminsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const admins = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.role, 'admin'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Administradores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona quién tiene acceso al panel de administración
        </p>
      </div>
      <AdminsManager initialAdmins={admins} currentUserId={session.userId} />
    </div>
  )
}
