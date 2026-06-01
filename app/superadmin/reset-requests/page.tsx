import { db } from '@/lib/db'
import { passwordResetRequests, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import ResetRequestsManager from '@/components/superadmin/ResetRequestsManager'

export const revalidate = 0

export default async function SuperAdminResetRequestsPage() {
  const requests = await db
    .select({
      id: passwordResetRequests.id,
      email: passwordResetRequests.email,
      message: passwordResetRequests.message,
      status: passwordResetRequests.status,
      createdAt: passwordResetRequests.createdAt,
      resolvedAt: passwordResetRequests.resolvedAt,
      userId: passwordResetRequests.userId,
      userName: users.name,
    })
    .from(passwordResetRequests)
    .leftJoin(users, eq(passwordResetRequests.userId, users.id))
    .orderBy(desc(passwordResetRequests.createdAt))

  return (
    <div className="relative min-h-screen gradient-bg p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">Super Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-gradient-gold">Recuperación de contraseñas</h1>
        </div>
        <ResetRequestsManager initialRequests={requests} />
      </div>
    </div>
  )
}
