import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { calcMatchPoints } from '@/lib/scoring'

type RouteContext = { params: Promise<{ pollaId: string; matchId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, matchId } = await params

  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { score1, score2 } = await req.json()
  if (typeof score1 !== 'number' || typeof score2 !== 'number') {
    return NextResponse.json({ error: 'Marcadores inválidos' }, { status: 400 })
  }

  const match = await db.select().from(matches).where(eq(matches.id, Number(matchId))).limit(1)
  if (match.length === 0) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  await db.update(matches)
    .set({ score1, score2, status: 'FINISHED', updatedAt: new Date() })
    .where(eq(matches.id, Number(matchId)))

  const config = await getPollaConfig(pollaId)

  const preds = await db.select().from(predictions)
    .where(and(eq(predictions.matchId, Number(matchId)), eq(predictions.pollaId, pollaId)))

  for (const pred of preds) {
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config)
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }

  return NextResponse.json({ ok: true, updated: preds.length })
}
