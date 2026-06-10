import { db } from '@/lib/db'
import { matches, specialPredictions, pollaMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'
import SpecialPredictionsForm from '@/components/predictions/SpecialPredictionsForm'
import PredictionTabs from '@/components/predictions/PredictionTabs'
import ImportPredictionsButton from '@/components/predictions/ImportPredictionsButton'

export const revalidate = 60

export default async function PollaSpecialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [allMatches, mySpecials, config, myRole] = await Promise.all([
    db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE')),
    db.select().from(specialPredictions).where(
      and(eq(specialPredictions.userId, session.userId), eq(specialPredictions.pollaId, polla.id))
    ),
    getPollaConfig(polla.id),
    getMemberRole(polla.id, session.userId),
  ])

  const isAdmin = myRole === 'admin'
  const members = isAdmin
    ? await db.select({ id: users.id, name: users.name })
        .from(pollaMembers)
        .innerJoin(users, eq(pollaMembers.userId, users.id))
        .where(eq(pollaMembers.pollaId, polla.id))
    : []

  const allTeams = Array.from(new Set([
    ...allMatches.map(m => m.team1),
    ...allMatches.map(m => m.team2),
  ])).filter(t => !t.startsWith('W') && !t.startsWith('L') && !t.startsWith('2')).sort()

  const isLocked = allMatches.length > 0
    ? (() => {
        const first = allMatches.reduce((e, m) => new Date(m.matchDatetime) < new Date(e.matchDatetime) ? m : e)
        return first.lockTime ? new Date() >= new Date(first.lockTime) : false
      })()
    : false

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
        <ImportPredictionsButton pollaId={polla.id} isAdmin={isAdmin} members={members} />
      </div>

      <PredictionTabs active="specials" pollaSlug={slug} showQuestions={config['feature_custom_questions'] === 'true'} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Predicciones Especiales</h2>
        <p className="text-muted-foreground text-sm">
          Se cierran antes del primer partido del torneo (11 Jun 2026)
        </p>
      </div>

      <SpecialPredictionsForm
        teams={allTeams}
        initialSpecials={mySpecials}
        config={config}
        isLocked={isLocked}
        pollaId={polla.id}
      />
    </div>
  )
}
