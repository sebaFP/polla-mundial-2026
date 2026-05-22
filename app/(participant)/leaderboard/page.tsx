import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { tournamentConfig, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DEFAULT_CONFIG } from '@/lib/scoring'
import LeaderboardView from '@/components/leaderboard/LeaderboardView'

export const revalidate = 30

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [configRows, approvedUsers] = await Promise.all([
    db.select().from(tournamentConfig),
    db.select({ id: users.id }).from(users).where(eq(users.inscriptionStatus, 'approved')),
  ])

  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(configRows.map(r => [r.key, r.value])) }

  const prizePoolEnabled = config.prize_pool_enabled === 'true'
  const inscriptionEnabled = config.inscription_enabled === 'true'
  const fee = parseInt(config.inscription_fee ?? '0') || 0
  const currency = config.inscription_currency ?? 'CLP'
  const approvedCount = approvedUsers.length
  const totalPool = approvedCount * fee
  const prize1Pct = parseInt(config.prize_1_pct ?? '60') || 60
  const prize2Pct = parseInt(config.prize_2_pct ?? '30') || 30
  const prize3Pct = parseInt(config.prize_3_pct ?? '10') || 10

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Tabla de Posiciones</h1>
        <p className="text-muted-foreground text-sm mt-1">Actualizada en tiempo real</p>
      </div>
      <LeaderboardView
        currentUserId={session.userId}
        prizePoolEnabled={prizePoolEnabled && inscriptionEnabled && fee > 0}
        totalPool={totalPool}
        currency={currency}
        prize1Pct={prize1Pct}
        prize2Pct={prize2Pct}
        prize3Pct={prize3Pct}
      />
    </div>
  )
}
