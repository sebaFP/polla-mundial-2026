import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches, predictions, pollaResultOverrides } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { calcMatchPoints } from '@/lib/scoring'
import { rebuildGroupStandings, recalcGroupPredictions } from '@/lib/football-data/sync'

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

  // Upsert override — does not touch global matches table
  await db.insert(pollaResultOverrides)
    .values({ pollaId, matchId: Number(matchId), score1, score2 })
    .onConflictDoUpdate({
      target: [pollaResultOverrides.pollaId, pollaResultOverrides.matchId],
      set: { score1, score2, updatedAt: new Date() },
    })

  const config = await getPollaConfig(pollaId)

  const preds = await db.select().from(predictions)
    .where(and(eq(predictions.matchId, Number(matchId)), eq(predictions.pollaId, pollaId)))

  for (const pred of preds) {
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config)
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }

  // If GROUP_STAGE, rebuild standings and recalc group prediction points
  const m = match[0]
  if (m.stage === 'GROUP_STAGE' && m.groupName) {
    await rebuildGroupStandings(m.groupName)
    await recalcGroupPredictions(m.groupName)
  }

  return NextResponse.json({ ok: true, updated: preds.length })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, matchId } = await params

  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(pollaResultOverrides)
    .where(and(
      eq(pollaResultOverrides.pollaId, pollaId),
      eq(pollaResultOverrides.matchId, Number(matchId)),
    ))

  // Recalc predictions using API scores from matches table
  const match = await db.select().from(matches).where(eq(matches.id, Number(matchId))).limit(1)
  const apiScore1 = match[0]?.score1
  const apiScore2 = match[0]?.score2

  const config = await getPollaConfig(pollaId)

  const preds = await db.select().from(predictions)
    .where(and(eq(predictions.matchId, Number(matchId)), eq(predictions.pollaId, pollaId)))

  for (const pred of preds) {
    const pts = (apiScore1 !== null && apiScore2 !== null && apiScore1 !== undefined && apiScore2 !== undefined)
      ? calcMatchPoints(pred.predictedScore1, pred.predictedScore2, apiScore1, apiScore2, config)
      : null
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }

  return NextResponse.json({ ok: true, updated: preds.length })
}
