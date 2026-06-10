import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions, pollaAnswers, matches } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, isPollaOpen } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requestedUserId = req.nextUrl.searchParams.get('userId') ?? session.userId
  if (myRole !== 'admin' && requestedUserId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const questions = await db.select().from(pollaQuestions)
    .where(and(eq(pollaQuestions.pollaId, pollaId), eq(pollaQuestions.enabled, true)))
    .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt))

  const options = await db.select().from(pollaQuestionOptions).orderBy(asc(pollaQuestionOptions.order))
  const answers = await db.select().from(pollaAnswers)
    .where(and(eq(pollaAnswers.userId, requestedUserId), eq(pollaAnswers.pollaId, pollaId)))

  const optionsByQuestion = options.reduce<Record<string, typeof options>>((acc, o) => {
    ;(acc[o.questionId] ??= []).push(o)
    return acc
  }, {})
  const answerByQuestion = Object.fromEntries(answers.map(a => [a.questionId, a]))

  return NextResponse.json(questions.map(q => ({
    ...q,
    options: optionsByQuestion[q.id] ?? [],
    myAnswer: answerByQuestion[q.id] ?? null,
  })))
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await isPollaOpen(pollaId))) {
    return NextResponse.json({ error: 'La polla está cerrada temporalmente' }, { status: 403 })
  }

  // Global lock: check first group stage match
  const groupMatches = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
  if (groupMatches.length > 0) {
    const first = groupMatches.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
    if (first.lockTime && new Date() >= new Date(first.lockTime)) {
      return NextResponse.json({ error: 'Las preguntas están cerradas — el torneo ya comenzó' }, { status: 403 })
    }
  }

  const { questionId, answer, optionId } = await req.json() as {
    questionId: string
    answer?: string
    optionId?: string
  }

  const [question] = await db.select().from(pollaQuestions)
    .where(and(eq(pollaQuestions.id, questionId), eq(pollaQuestions.pollaId, pollaId), eq(pollaQuestions.enabled, true)))
  if (!question) return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })

  await db.insert(pollaAnswers).values({
    userId: session.userId,
    pollaId,
    questionId,
    answer: question.type !== 'range' ? (answer?.trim() ?? null) : null,
    optionId: question.type === 'range' ? (optionId ?? null) : null,
  }).onConflictDoUpdate({
    target: [pollaAnswers.userId, pollaAnswers.questionId, pollaAnswers.pollaId],
    set: {
      answer: question.type !== 'range' ? (answer?.trim() ?? null) : null,
      optionId: question.type === 'range' ? (optionId ?? null) : null,
      points: null,
    },
  })

  return NextResponse.json({ ok: true })
}
