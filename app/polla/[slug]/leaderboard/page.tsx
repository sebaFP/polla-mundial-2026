import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { db } from '@/lib/db'
import { pollaMembers } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import LeaderboardView from '@/components/leaderboard/LeaderboardView'

export const revalidate = 30

export default async function PollaLeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const config = await getPollaConfig(polla.id)

  const [{ approvedCount }] = await db.select({
    approvedCount: sql<number>`COUNT(*)`,
  }).from(pollaMembers).where(
    and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.inscriptionStatus, 'approved'))
  )

  const prizePoolEnabled = config.prize_pool_enabled === 'true'
  const inscriptionEnabled = config.inscription_enabled === 'true'
  const fee = parseInt(config.inscription_fee ?? '0') || 0
  const currency = config.inscription_currency ?? 'CLP'
  const totalPool = Number(approvedCount) * fee
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
        pollaId={polla.id}
        pollaName={polla.name}
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
