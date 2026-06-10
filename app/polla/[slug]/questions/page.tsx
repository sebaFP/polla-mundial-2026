import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions, pollaAnswers, matches, users, pollaMembers } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'
import PredictionTabs from '@/components/predictions/PredictionTabs'
import CustomQuestionsForm from '@/components/predictions/CustomQuestionsForm'
import ImportPredictionsButton from '@/components/predictions/ImportPredictionsButton'

export const revalidate = 0

export default async function PollaQuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [config, myRole] = await Promise.all([
    getPollaConfig(polla.id),
    getMemberRole(polla.id, session.userId),
  ])

  if (config['feature_custom_questions'] !== 'true') {
    redirect(`/polla/${slug}/predictions`)
  }

  const isAdmin = myRole === 'admin'
  const membersList = isAdmin
    ? await db.select({ id: users.id, name: users.name })
        .from(pollaMembers)
        .innerJoin(users, eq(pollaMembers.userId, users.id))
        .where(eq(pollaMembers.pollaId, polla.id))
    : []

  const questions = await db.select().from(pollaQuestions)
    .where(and(eq(pollaQuestions.pollaId, polla.id), eq(pollaQuestions.enabled, true)))
    .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt))

  const options = await db.select().from(pollaQuestionOptions).orderBy(asc(pollaQuestionOptions.order))
  const myAnswers = await db.select().from(pollaAnswers)
    .where(and(eq(pollaAnswers.userId, session.userId), eq(pollaAnswers.pollaId, polla.id)))

  const optionsByQuestion = options.reduce<Record<string, typeof options>>((acc, o) => {
    ;(acc[o.questionId] ??= []).push(o)
    return acc
  }, {})
  const answerByQuestion = Object.fromEntries(myAnswers.map(a => [a.questionId, a]))
  const questionsWithData = questions.map(q => ({
    ...q,
    options: optionsByQuestion[q.id] ?? [],
    myAnswer: answerByQuestion[q.id] ?? null,
  }))

  const allGroupMatches = await db.select({ team1: matches.team1, team2: matches.team2, stage: matches.stage })
    .from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
  const allTeams = Array.from(new Set([...allGroupMatches.map(m => m.team1), ...allGroupMatches.map(m => m.team2)]))
    .filter(t => !t.startsWith('W') && !t.startsWith('L') && !t.startsWith('2')).sort()


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
        <ImportPredictionsButton pollaId={polla.id} isAdmin={isAdmin} members={membersList} />
      </div>

      <PredictionTabs active="questions" pollaSlug={slug} showQuestions />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Preguntas Personalizadas</h2>
        <p className="text-muted-foreground text-sm">
          Se cierran antes del primer partido del torneo
        </p>
      </div>

      {questionsWithData.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          El administrador no ha creado preguntas todavía.
        </div>
      ) : (
        <CustomQuestionsForm
          questions={questionsWithData}
          pollaId={polla.id}
          teams={allTeams}
        />
      )}
    </div>
  )
}
