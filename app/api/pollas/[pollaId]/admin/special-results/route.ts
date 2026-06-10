import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { specialPredictions, tournamentConfig } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { calcSpecialPoints } from '@/lib/scoring'

type RouteContext = { params: Promise<{ pollaId: string }> }

const RANGE_TYPES = new Set([
  'bonus_red_cards_range', 'bonus_goals_range', 'bonus_penalties_range', 'bonus_group_top_scorer',
])

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })
  if ((await getMemberRole(pollaId, session.userId)) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, value } = await req.json() as { type: string; value: string }
  if (!type || value === undefined || value === null) {
    return NextResponse.json({ error: 'type y value requeridos' }, { status: 400 })
  }

  const correct = value.trim()

  // Store correct answer in config
  const configKey = `result_${type}`
  await db.insert(tournamentConfig).values({ pollaId, key: configKey, value: correct })
    .onConflictDoUpdate({
      target: [tournamentConfig.pollaId, tournamentConfig.key],
      set: { value: correct },
    })

  // Recalculate points for all predictions of this type in this polla
  const config = await getPollaConfig(pollaId)
  const preds = await db.select().from(specialPredictions)
    .where(and(eq(specialPredictions.pollaId, pollaId), eq(specialPredictions.type, type)))

  const isRange = RANGE_TYPES.has(type)

  for (const pred of preds) {
    const predicted = (pred.teamName ?? pred.playerName ?? '').trim()
    // Range: exact label match. Team/player: case-insensitive.
    const matched = isRange
      ? predicted === correct
      : predicted.toLowerCase() === correct.toLowerCase()
    // Pass identical values to calcSpecialPoints to force it to return the configured pts
    const pts = matched ? calcSpecialPoints(type, correct, correct, config) : 0
    await db.update(specialPredictions).set({ points: pts }).where(eq(specialPredictions.id, pred.id))
  }

  return NextResponse.json({ ok: true, updated: preds.length })
}
