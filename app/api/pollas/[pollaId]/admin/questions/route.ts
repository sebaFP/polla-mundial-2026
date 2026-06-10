import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const questions = await db.select().from(pollaQuestions)
    .where(eq(pollaQuestions.pollaId, pollaId))
    .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt))

  const options = await db.select().from(pollaQuestionOptions)
    .orderBy(asc(pollaQuestionOptions.order))

  const optionsByQuestion = options.reduce<Record<string, typeof options>>((acc, o) => {
    ;(acc[o.questionId] ??= []).push(o)
    return acc
  }, {})

  return NextResponse.json(questions.map(q => ({ ...q, options: optionsByQuestion[q.id] ?? [] })))
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, description, type, pointsValue, options } = await req.json() as {
    title: string
    description?: string
    type: 'team' | 'player' | 'range'
    pointsValue?: number
    options?: Array<{ label: string; points: number }>
  }

  if (!title?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })
  if (!['team', 'player', 'range'].includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const [question] = await db.insert(pollaQuestions).values({
    pollaId,
    title: title.trim(),
    description: description?.trim() || null,
    type,
    pointsValue: type !== 'range' ? (pointsValue ?? 5) : null,
  }).returning()

  if (type === 'range' && Array.isArray(options) && options.length > 0) {
    await db.insert(pollaQuestionOptions).values(
      options.map((o, i) => ({ questionId: question.id, label: o.label, points: o.points, order: i }))
    )
  }

  const opts = await db.select().from(pollaQuestionOptions)
    .where(eq(pollaQuestionOptions.questionId, question.id))
    .orderBy(asc(pollaQuestionOptions.order))

  return NextResponse.json({ ...question, options: opts }, { status: 201 })
}
