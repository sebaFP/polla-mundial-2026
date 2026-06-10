import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { specialPredictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, isPollaOpen, getPollaById } from '@/lib/polla'

const VALID_TYPES = [
  'champion', 'finalist', 'third', 'top_scorer', 'best_goalkeeper', 'best_player',
  'bonus_most_goals_team', 'bonus_most_conceded_team', 'bonus_red_cards_range',
  'bonus_goals_range', 'bonus_penalties_range', 'bonus_group_top_scorer',
]

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requestedUserId = req.nextUrl.searchParams.get('userId') ?? session.userId
  if (myRole !== 'admin' && requestedUserId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(specialPredictions)
    .where(and(eq(specialPredictions.userId, requestedUserId), eq(specialPredictions.pollaId, pollaId)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await isPollaOpen(pollaId))) {
    return NextResponse.json({ error: 'La polla está cerrada temporalmente' }, { status: 403 })
  }

  const { type, teamName, playerName } = await req.json()
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const firstMatch = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
  if (firstMatch.length > 0) {
    const earliest = firstMatch.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
    if (earliest.lockTime && new Date() >= earliest.lockTime) {
      return NextResponse.json({ error: 'Predicciones especiales cerradas' }, { status: 403 })
    }
  }

  const existing = await db.select().from(specialPredictions)
    .where(and(
      eq(specialPredictions.userId, session.userId),
      eq(specialPredictions.type, type),
      eq(specialPredictions.pollaId, pollaId),
    ))
    .limit(1)

  if (existing.length > 0) {
    const updated = await db.update(specialPredictions)
      .set({ teamName: teamName ?? null, playerName: playerName ?? null })
      .where(eq(specialPredictions.id, existing[0].id))
      .returning()
    return NextResponse.json(updated[0])
  }

  const created = await db.insert(specialPredictions).values({
    userId: session.userId,
    pollaId,
    type,
    teamName: teamName ?? null,
    playerName: playerName ?? null,
  }).returning()

  return NextResponse.json(created[0], { status: 201 })
}
