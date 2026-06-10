import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaQuestionOptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string; questionId: string; optionId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId, optionId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { label, points } = await req.json() as { label?: string; points?: number }
  const set: Record<string, unknown> = {}
  if (label !== undefined) set.label = label.trim()
  if (points !== undefined) set.points = points

  const [updated] = await db.update(pollaQuestionOptions).set(set)
    .where(eq(pollaQuestionOptions.id, optionId))
    .returning()

  if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pollaId, optionId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(pollaQuestionOptions).where(eq(pollaQuestionOptions.id, optionId))
  return NextResponse.json({ ok: true })
}
