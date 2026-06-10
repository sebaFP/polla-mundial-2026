import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
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

  const { label, points } = await req.json() as { label: string; points: number }
  if (!label?.trim()) return NextResponse.json({ error: 'Etiqueta requerida' }, { status: 400 })

  const existing = await db.select().from(pollaQuestionOptions)
    .where(eq(pollaQuestionOptions.questionId, questionId))
    .orderBy(asc(pollaQuestionOptions.order))

  const [created] = await db.insert(pollaQuestionOptions).values({
    questionId,
    label: label.trim(),
    points: points ?? 3,
    order: existing.length,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}
