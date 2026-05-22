import { db } from '@/lib/db'
import { users, invitations, predictions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import ParticipantsManager from '@/components/admin/ParticipantsManager'

export const revalidate = 0

export default async function ParticipantsPage() {
  const allUsers = await db.select().from(users).where(eq(users.role, 'participant'))

  const pts = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
      predicted: sql<number>`COUNT(${predictions.id})`,
    })
    .from(predictions)
    .groupBy(predictions.userId)

  const invs = await db.select({ userId: invitations.userId, token: invitations.token }).from(invitations)

  const ptsMap = Object.fromEntries(pts.map(r => [r.userId, { total: Number(r.total), predicted: Number(r.predicted) }]))
  const tokenMap = Object.fromEntries(invs.map(i => [i.userId, i.token]))

  const participants = allUsers.map(u => ({
    ...u,
    totalPoints: ptsMap[u.id]?.total ?? 0,
    predictedMatches: ptsMap[u.id]?.predicted ?? 0,
    qrToken: tokenMap[u.id] ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Participantes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona participantes y genera sus QR de acceso
        </p>
      </div>
      <ParticipantsManager initialParticipants={participants} />
    </div>
  )
}
