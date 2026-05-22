import { db } from '@/lib/db'
import { matches, specialPredictions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import SpecialPredictionsForm from '@/components/predictions/SpecialPredictionsForm'
import PredictionTabs from '@/components/predictions/PredictionTabs'

export const revalidate = 60

export default async function PollaSpecialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [allMatches, mySpecials, config] = await Promise.all([
    db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE')),
    db.select().from(specialPredictions).where(
      and(eq(specialPredictions.userId, session.userId), eq(specialPredictions.pollaId, polla.id))
    ),
    getPollaConfig(polla.id),
  ])

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
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
      </div>

      <PredictionTabs active="specials" pollaSlug={slug} />

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
