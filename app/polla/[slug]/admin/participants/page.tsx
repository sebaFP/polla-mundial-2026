import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { pollaMembers, users, invitations, predictions } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import PollaParticipantsManager from '@/components/admin/PollaParticipantsManager'

export const revalidate = 0

export default async function PollaParticipantsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [membersRaw, invs, pts, config] = await Promise.all([
    db.select({
      id: pollaMembers.id,
      userId: pollaMembers.userId,
      role: pollaMembers.role,
      inscriptionStatus: pollaMembers.inscriptionStatus,
      inscriptionNotes: pollaMembers.inscriptionNotes,
      joinedAt: pollaMembers.joinedAt,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
    })
      .from(pollaMembers)
      .innerJoin(users, eq(pollaMembers.userId, users.id))
      .where(eq(pollaMembers.pollaId, polla.id)),

    db.select({ userId: invitations.userId, token: invitations.token })
      .from(invitations)
      .where(eq(invitations.pollaId, polla.id)),

    db.select({
      userId: predictions.userId,
      total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
      predicted: sql<number>`COUNT(${predictions.id})`,
    })
      .from(predictions)
      .where(eq(predictions.pollaId, polla.id))
      .groupBy(predictions.userId),

    getPollaConfig(polla.id),
  ])

  const tokenMap = Object.fromEntries(invs.map(i => [i.userId, i.token]))
  const ptsMap = Object.fromEntries(pts.map(r => [r.userId, { total: Number(r.total), predicted: Number(r.predicted) }]))

  const participants = membersRaw
    .filter(m => m.role === 'participant' || (m.role === 'admin' && m.inscriptionStatus === 'approved'))
    .map(m => ({
      ...m,
      totalPoints: ptsMap[m.userId]?.total ?? 0,
      predictedMatches: ptsMap[m.userId]?.predicted ?? 0,
      qrToken: tokenMap[m.userId] ?? null,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Participantes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona participantes, inscripciones y genera sus QR de acceso
        </p>
      </div>
      <PollaParticipantsManager
        pollaId={polla.id}
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
