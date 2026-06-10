import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions, matches } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug } from '@/lib/polla'
import { redirect } from 'next/navigation'
import QuestionsManager from '@/components/admin/QuestionsManager'

export const revalidate = 0

export default async function AdminQuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const questions = await db.select().from(pollaQuestions)
    .where(eq(pollaQuestions.pollaId, polla.id))
    .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt))

  const options = await db.select().from(pollaQuestionOptions).orderBy(asc(pollaQuestionOptions.order))

  const optionsByQuestion = options.reduce<Record<string, typeof options>>((acc, o) => {
    ;(acc[o.questionId] ??= []).push(o)
    return acc
  }, {})

  const questionsWithOptions = questions.map(q => ({ ...q, options: optionsByQuestion[q.id] ?? [] }))

  const allMatches = await db.select({ team1: matches.team1, team2: matches.team2 })
    .from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
  const allTeams = Array.from(new Set([...allMatches.map(m => m.team1), ...allMatches.map(m => m.team2)]))
    .filter(t => !t.startsWith('W') && !t.startsWith('L') && !t.startsWith('2')).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Preguntas Personalizadas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crea preguntas para tu polla — se cierran antes del primer partido del torneo
        </p>
      </div>
      <QuestionsManager
        initialQuestions={questionsWithOptions}
        pollaId={polla.id}
        allTeams={allTeams}
      />
    </div>
  )
}
