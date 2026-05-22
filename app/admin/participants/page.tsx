import { db } from '@/lib/db'
import { users, predictions, tournamentConfig } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { DEFAULT_CONFIG } from '@/lib/scoring'
import ParticipantsManager from '@/components/admin/ParticipantsManager'

export const revalidate = 0

export default async function ParticipantsPage() {
  const [allUsers, pts, configRows] = await Promise.all([
    db.select().from(users).where(eq(users.role, 'participant')),
    db
      .select({
        userId: predictions.userId,
        total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
        predicted: sql<number>`COUNT(${predictions.id})`,
      })
      .from(predictions)
      .groupBy(predictions.userId),
    db.select().from(tournamentConfig),
  ])

  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(configRows.map(r => [r.key, r.value])) }
  const ptsMap = Object.fromEntries(pts.map(r => [r.userId, { total: Number(r.total), predicted: Number(r.predicted) }]))

  const participants = allUsers.map(u => ({
    ...u,
    totalPoints: ptsMap[u.id]?.total ?? 0,
    predictedMatches: ptsMap[u.id]?.predicted ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Participantes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona participantes, inscripciones y genera sus QR de acceso
        </p>
      </div>
      <ParticipantsManager
        initialParticipants={participants}
        inscriptionEnabled={config.inscription_enabled === 'true'}
        inscriptionFee={parseInt(config.inscription_fee ?? '0') || 0}
        inscriptionCurrency={config.inscription_currency ?? 'CLP'}
        prizePoolEnabled={config.prize_pool_enabled === 'true'}
        prize1Pct={parseInt(config.prize_1_pct ?? '60') || 60}
        prize2Pct={parseInt(config.prize_2_pct ?? '30') || 30}
        prize3Pct={parseInt(config.prize_3_pct ?? '10') || 10}
      />
    </div>
  )
}
