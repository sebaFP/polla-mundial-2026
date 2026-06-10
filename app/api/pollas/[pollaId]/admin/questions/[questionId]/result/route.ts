import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions, pollaAnswers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string; questionId: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId, questionId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [question] = await db.select().from(pollaQuestions)
    .where(and(eq(pollaQuestions.id, questionId), eq(pollaQuestions.pollaId, pollaId)))
  if (!question) return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })

  const { correctAnswer, correctOptionId } = await req.json() as {
    correctAnswer?: string
    correctOptionId?: string
  }

  if (question.type === 'range') {
    if (!correctOptionId) return NextResponse.json({ error: 'correctOptionId requerido' }, { status: 400 })

    // Mark the correct option, clear others
    const options = await db.select().from(pollaQuestionOptions)
      .where(eq(pollaQuestionOptions.questionId, questionId))

    for (const opt of options) {
      await db.update(pollaQuestionOptions)
        .set({ isCorrect: opt.id === correctOptionId })
        .where(eq(pollaQuestionOptions.id, opt.id))
    }

    const correctOption = options.find(o => o.id === correctOptionId)
    if (!correctOption) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 })

    // Recalculate points for all answers
    const answers = await db.select().from(pollaAnswers)
      .where(and(eq(pollaAnswers.questionId, questionId), eq(pollaAnswers.pollaId, pollaId)))

    for (const ans of answers) {
      const pts = ans.optionId === correctOptionId ? correctOption.points : 0
      await db.update(pollaAnswers).set({ points: pts }).where(eq(pollaAnswers.id, ans.id))
    }
  } else {
    if (!correctAnswer?.trim()) return NextResponse.json({ error: 'correctAnswer requerido' }, { status: 400 })

    await db.update(pollaQuestions)
      .set({ correctAnswer: correctAnswer.trim() })
      .where(eq(pollaQuestions.id, questionId))

    const answers = await db.select().from(pollaAnswers)
      .where(and(eq(pollaAnswers.questionId, questionId), eq(pollaAnswers.pollaId, pollaId)))

    const normalizedCorrect = correctAnswer.trim().toLowerCase()
    for (const ans of answers) {
      const pts = ans.answer?.toLowerCase() === normalizedCorrect ? (question.pointsValue ?? 0) : 0
      await db.update(pollaAnswers).set({ points: pts }).where(eq(pollaAnswers.id, ans.id))
    }
  }

  return NextResponse.json({ ok: true })
}
