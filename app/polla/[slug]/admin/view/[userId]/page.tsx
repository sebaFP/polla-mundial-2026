import { db } from '@/lib/db'
import {
  matches, predictions, groupPredictions, specialPredictions,
  pollaQuestions, pollaQuestionOptions, pollaAnswers, users,
} from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFlag } from '@/lib/teams'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import AdminMatchPredictions from '@/components/admin/AdminMatchPredictions'

export const revalidate = 0

export default async function AdminViewParticipantPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug, userId } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const myRole = await getMemberRole(polla.id, session.userId)
  if (myRole !== 'admin') redirect(`/polla/${slug}`)

  const config = await getPollaConfig(polla.id)
  const featGroups = config.feature_group_predictions === 'true'
  const featSpecials = config.feature_special_predictions === 'true'
  const featQuestions = config.feature_custom_questions === 'true'

  const [targetUser, allMatches, userPreds, userGroupPreds, userSpecials] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)).then(r => r[0] ?? null),
    db.select().from(matches).orderBy(matches.matchDatetime),
    db.select().from(predictions).where(
      and(eq(predictions.userId, userId), eq(predictions.pollaId, polla.id))
    ),
    featGroups
      ? db.select().from(groupPredictions).where(
          and(eq(groupPredictions.userId, userId), eq(groupPredictions.pollaId, polla.id))
        )
      : Promise.resolve([]),
    featSpecials
      ? db.select().from(specialPredictions).where(
          and(eq(specialPredictions.userId, userId), eq(specialPredictions.pollaId, polla.id))
        )
      : Promise.resolve([]),
  ])

  if (!targetUser) redirect(`/polla/${slug}/admin/participants`)

  // Questions
  let questionsWithAnswers: Array<{
    id: string
    title: string
    type: string
    answer: string | null
    points: number | null
  }> = []

  if (featQuestions) {
    const questions = await db.select().from(pollaQuestions)
      .where(and(eq(pollaQuestions.pollaId, polla.id), eq(pollaQuestions.enabled, true)))
      .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt))

    const answers = await db.select().from(pollaAnswers)
      .where(and(eq(pollaAnswers.userId, userId), eq(pollaAnswers.pollaId, polla.id)))

    const options = await db.select().from(pollaQuestionOptions)

    const optMap = Object.fromEntries(options.map(o => [o.id, o.label]))
    const ansMap = Object.fromEntries(answers.map(a => [a.questionId, a]))

    questionsWithAnswers = questions.map(q => {
      const ans = ansMap[q.id]
      let displayAnswer: string | null = null
      if (ans) {
        if (ans.optionId) displayAnswer = optMap[ans.optionId] ?? ans.answer
        else displayAnswer = ans.answer
      }
      return { id: q.id, title: q.title, type: q.type, answer: displayAnswer, points: ans?.points ?? null }
    })
  }

  const totalPoints = userPreds.reduce((s, p) => s + (p.points ?? 0), 0)
    + userGroupPreds.reduce((s, p) => s + (p.pointsFirst ?? 0) + (p.pointsSecond ?? 0) + (p.pointsThird ?? 0), 0)
    + userSpecials.reduce((s, p) => s + (p.points ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/polla/${slug}/admin/participants`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">{targetUser.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{totalPoints} pts totales · {userPreds.length}/{allMatches.length} partidos</p>
        </div>
      </div>

      {/* Match predictions — editable */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Partidos</h2>
        <AdminMatchPredictions
          matches={allMatches}
          initialPredictions={userPreds}
          targetUserId={userId}
          pollaId={polla.id}
        />
      </div>

      {/* Group predictions — read-only */}
      {featGroups && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Grupos ({userGroupPreds.length} de 12)</h2>
          {userGroupPreds.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Sin pronósticos de grupos</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {userGroupPreds.sort((a, b) => a.groupName.localeCompare(b.groupName)).map(gp => (
                <Card key={gp.id} className="glass-card p-3 space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Grupo {gp.groupName}
                  </p>
                  <div className="space-y-0.5 text-sm">
                    <p>🥇 {getFlag(gp.firstPlace)} {gp.firstPlace}
                      {gp.pointsFirst !== null && <span className="text-primary text-xs ml-1">+{gp.pointsFirst}</span>}
                    </p>
                    <p>🥈 {getFlag(gp.secondPlace)} {gp.secondPlace}
                      {gp.pointsSecond !== null && <span className="text-primary text-xs ml-1">+{gp.pointsSecond}</span>}
                    </p>
                    {gp.thirdPlace && (
                      <p>🥉 {getFlag(gp.thirdPlace)} {gp.thirdPlace}
                        {gp.pointsThird !== null && <span className="text-primary text-xs ml-1">+{gp.pointsThird}</span>}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Special predictions — read-only */}
      {featSpecials && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Especiales ({userSpecials.length})</h2>
          {userSpecials.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Sin predicciones especiales</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {userSpecials.map(sp => (
                <Card key={sp.id} className="glass-card p-3">
                  <p className="text-xs text-muted-foreground capitalize mb-1">
                    {sp.type.replace(/_/g, ' ')}
                  </p>
                  <p className="font-semibold text-sm">
                    {sp.teamName
                      ? `${getFlag(sp.teamName)} ${sp.teamName}`
                      : sp.playerName ?? '—'}
                  </p>
                  {sp.points !== null && (
                    <p className="text-primary text-xs mt-0.5">+{sp.points} pts</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom questions — read-only */}
      {featQuestions && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            Preguntas ({questionsWithAnswers.filter(q => q.answer).length} de {questionsWithAnswers.length})
          </h2>
          {questionsWithAnswers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Sin preguntas</p>
          ) : (
            <div className="space-y-2">
              {questionsWithAnswers.map(q => (
                <Card key={q.id} className="glass-card p-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{q.title}</p>
                  <div className="shrink-0 text-right">
                    {q.answer ? (
                      <div>
                        <p className="text-sm font-semibold">{q.answer}</p>
                        {q.points !== null && (
                          <p className="text-primary text-xs">+{q.points} pts</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin respuesta</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
