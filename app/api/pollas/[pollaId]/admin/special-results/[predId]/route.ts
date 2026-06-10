import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { specialPredictions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { calcSpecialPoints } from '@/lib/scoring'

type RouteContext = { params: Promise<{ pollaId: string; predId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, predId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [pred] = await db.select().from(specialPredictions)
    .where(and(eq(specialPredictions.id, predId), eq(specialPredictions.pollaId, pollaId)))
  if (!pred) return NextResponse.json({ error: 'Predicción no encontrada' }, { status: 404 })

  const { correct } = await req.json() as { correct: boolean }

  let pts = 0
  if (correct) {
    // Compute points using the stored correct answer as if exact match
    const config = await getPollaConfig(pollaId)
    const predicted = pred.teamName ?? pred.playerName ?? ''
    pts = calcSpecialPoints(pred.type, predicted, predicted, config)
  }

  await db.update(specialPredictions).set({ points: pts }).where(eq(specialPredictions.id, predId))

  return NextResponse.json({ ok: true, points: pts })
}
