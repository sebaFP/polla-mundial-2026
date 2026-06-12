import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { db } from '@/lib/db'
import { pollaMembers } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import LeaderboardView from '@/components/leaderboard/LeaderboardView'
import ShareLeaderboardButton from '@/components/leaderboard/ShareLeaderboardButton'
import Link from 'next/link'

export const revalidate = 30

export default async function PollaLeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const config = await getPollaConfig(polla.id)

  // Unauthenticated access only allowed for public pollas (layout already blocks private)
  const isPublicView = !session

  const prizePoolEnabled = !isPublicView && config.prize_pool_enabled === 'true'
  const inscriptionEnabled = config.inscription_enabled === 'true'
  const fee = parseInt(config.inscription_fee ?? '0') || 0
  const currency = config.inscription_currency ?? 'CLP'

  let totalPool = 0
  let prize1Pct = 60, prize2Pct = 30, prize3Pct = 10

  if (!isPublicView) {
    const [{ approvedCount }] = await db.select({
      approvedCount: sql<number>`COUNT(*)`,
    }).from(pollaMembers).where(
      and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.inscriptionStatus, 'approved'))
    )
    totalPool = Number(approvedCount) * fee
    prize1Pct = parseInt(config.prize_1_pct ?? '60') || 60
    prize2Pct = parseInt(config.prize_2_pct ?? '30') || 30
    prize3Pct = parseInt(config.prize_3_pct ?? '10') || 10
  }

  const isPublic = config.polla_visibility === 'public'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Tabla de Posiciones</h1>
          <p className="text-muted-foreground text-sm mt-1">{polla.name}</p>
        </div>
        {isPublic && <ShareLeaderboardButton />}
      </div>
      {isPublicView && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            Vista pública — solo lectura
          </span>
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Inicia sesión para participar →
          </Link>
        </div>
      )}
      <LeaderboardView
        currentUserId={session?.userId ?? null}
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
