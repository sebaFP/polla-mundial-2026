import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import UsersManager from '@/components/superadmin/UsersManager'

export const revalidate = 0

export default async function SuperAdminUsersPage() {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isSuperAdmin: users.isSuperAdmin,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt))

  return (
    <div className="relative min-h-screen gradient-bg p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">Super Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-gradient-gold">Usuarios</h1>
        </div>
        <UsersManager initialUsers={allUsers} />
      </div>
    </div>
  )
}
