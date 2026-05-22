import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches, predictions, tournamentConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { calcMatchPoints } from '@/lib/scoring'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { matchId } = await params
  const { score1, score2 } = await req.json()

  if (typeof score1 !== 'number' || typeof score2 !== 'number') {
    return NextResponse.json({ error: 'Marcadores inválidos' }, { status: 400 })
  }

  const match = await db.select().from(matches).where(eq(matches.id, Number(matchId))).limit(1)
  if (match.length === 0) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  await db.update(matches)
    .set({ score1, score2, status: 'FINISHED', updatedAt: new Date() })
    .where(eq(matches.id, Number(matchId)))

  // Get config for scoring
  const configRows = await db.select().from(tournamentConfig)
  const config = Object.fromEntries(configRows.map(r => [r.key, r.value]))

  // Recalculate all predictions for this match
  const preds = await db.select().from(predictions).where(eq(predictions.matchId, Number(matchId)))
  for (const pred of preds) {
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config)
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }

  return NextResponse.json({ ok: true, updated: preds.length })
}
