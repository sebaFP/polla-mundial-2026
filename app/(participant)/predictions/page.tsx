import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import MatchPredictions from '@/components/predictions/MatchPredictions'
import PredictionTabs from '@/components/predictions/PredictionTabs'

export const revalidate = 60

export default async function PredictionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allMatches = await db.select().from(matches)
  const myPredictions = await db.select().from(predictions).where(eq(predictions.userId, session.userId))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ingresa tus marcadores antes de cada partido
        </p>
      </div>

      <PredictionTabs active="matches" />

      <MatchPredictions
        matches={allMatches}
        initialPredictions={myPredictions}
        userId={session.userId}
      />
    </div>
  )
}
