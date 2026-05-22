import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug } from '@/lib/polla'
import { redirect } from 'next/navigation'
import MatchPredictions from '@/components/predictions/MatchPredictions'
import PredictionTabs from '@/components/predictions/PredictionTabs'

export const revalidate = 60

export default async function PollaPredictionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [allMatches, myPredictions] = await Promise.all([
    db.select().from(matches),
    db.select().from(predictions).where(
      and(eq(predictions.userId, session.userId), eq(predictions.pollaId, polla.id))
    ),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ingresa tus marcadores antes de cada partido
        </p>
      </div>

      <PredictionTabs active="matches" pollaSlug={slug} />

      <MatchPredictions
        matches={allMatches}
        initialPredictions={myPredictions}
        userId={session.userId}
        pollaId={polla.id}
      />
    </div>
  )
}
