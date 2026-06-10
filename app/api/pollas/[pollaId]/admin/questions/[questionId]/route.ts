import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestions, pollaQuestionOptions } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string; questionId: string }> }

async function requireAdmin(pollaId: string, userId: string) {
  if (!(await getPollaById(pollaId))) return 'not_found'
  const role = await getMemberRole(pollaId, userId)
  if (role !== 'admin') return 'forbidden'
  return 'ok'
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId, questionId } = await params
  const check = await requireAdmin(pollaId, session.userId)
  if (check === 'not_found') return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if (check === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    title?: string; description?: string; enabled?: boolean; order?: number; pointsValue?: number
  }
  const set: Record<string, unknown> = {}
  if (body.title !== undefined) set.title = body.title.trim()
  if (body.description !== undefined) set.description = body.description?.trim() || null
  if (body.enabled !== undefined) set.enabled = body.enabled
  if (body.order !== undefined) set.order = body.order
  if (body.pointsValue !== undefined) set.pointsValue = body.pointsValue

  const [updated] = await db.update(pollaQuestions).set(set)
    .where(and(eq(pollaQuestions.id, questionId), eq(pollaQuestions.pollaId, pollaId)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const options = await db.select().from(pollaQuestionOptions)
    .where(eq(pollaQuestionOptions.questionId, questionId))
    .orderBy(asc(pollaQuestionOptions.order))

  return NextResponse.json({ ...updated, options })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId, questionId } = await params
  const check = await requireAdmin(pollaId, session.userId)
  if (check === 'not_found') return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if (check === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(pollaQuestions)
    .where(and(eq(pollaQuestions.id, questionId), eq(pollaQuestions.pollaId, pollaId)))

  return NextResponse.json({ ok: true })
}
