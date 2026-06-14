import { db } from '@/lib/db'
import { matches, predictions, pollaMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole, getPollaConfig, isMemberPredictionUnlocked } from '@/lib/polla'
import { redirect } from 'next/navigation'
import MatchPredictions from '@/components/predictions/MatchPredictions'
import PredictionTabs from '@/components/predictions/PredictionTabs'
import ImportPredictionsButton from '@/components/predictions/ImportPredictionsButton'

export const revalidate = 60

export default async function PollaPredictionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [allMatches, myPredictions, myRole, config, predictionUnlocked] = await Promise.all([
    db.select().from(matches),
    db.select().from(predictions).where(
      and(eq(predictions.userId, session.userId), eq(predictions.pollaId, polla.id))
    ),
    getMemberRole(polla.id, session.userId),
    getPollaConfig(polla.id),
    isMemberPredictionUnlocked(polla.id, session.userId),
  ])

  const isAdmin = myRole === 'admin'
  const members = isAdmin
    ? await db.select({ id: users.id, name: users.name })
        .from(pollaMembers)
        .innerJoin(users, eq(pollaMembers.userId, users.id))
        .where(eq(pollaMembers.pollaId, polla.id))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ingresa tus marcadores antes de cada partido
          </p>
        </div>
        <ImportPredictionsButton
          pollaId={polla.id}
          isAdmin={isAdmin}
          members={members}
        />
      </div>

      <PredictionTabs active="matches" pollaSlug={slug} showQuestions={config['feature_custom_questions'] === 'true'} />

      <MatchPredictions
        matches={allMatches}
        initialPredictions={myPredictions}
        userId={session.userId}
        pollaId={polla.id}
        knockoutMode={config['knockout_prediction_mode'] ?? 'api'}
        lockMode={config['prediction_lock_mode'] ?? 'match'}
        predictionUnlocked={predictionUnlocked}
      />
    </div>
  )
}
