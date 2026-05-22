import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { predictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId') ?? session.userId
  // Participants can only see their own
  if (session.role !== 'admin' && userId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(predictions).where(eq(predictions.userId, userId))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId, predictedScore1, predictedScore2 } = await req.json()

  if (typeof matchId !== 'number' || typeof predictedScore1 !== 'number' || typeof predictedScore2 !== 'number') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  if (predictedScore1 < 0 || predictedScore2 < 0 || predictedScore1 > 30 || predictedScore2 > 30) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 })
  }

  // Check lock
  const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (match.length === 0) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  if (match[0].lockTime && new Date() >= match[0].lockTime) {
    return NextResponse.json({ error: 'Pronóstico cerrado para este partido' }, { status: 403 })
  }
  if (match[0].status !== 'SCHEDULED' && match[0].status !== 'TIMED') {
    return NextResponse.json({ error: 'Partido ya iniciado' }, { status: 403 })
  }
  // Check teams are resolved (for knockout)
  if (!match[0].team1Resolved || !match[0].team2Resolved) {
    if (match[0].stage !== 'GROUP_STAGE') {
      return NextResponse.json({ error: 'Equipos aún no confirmados' }, { status: 403 })
    }
  }

  // Upsert prediction
  const existing = await db.select().from(predictions)
    .where(and(eq(predictions.userId, session.userId), eq(predictions.matchId, matchId)))
    .limit(1)

  if (existing.length > 0) {
    const updated = await db.update(predictions)
      .set({ predictedScore1, predictedScore2, updatedAt: new Date() })
      .where(eq(predictions.id, existing[0].id))
      .returning()
    return NextResponse.json(updated[0])
  }

  const created = await db.insert(predictions).values({
    userId: session.userId,
    matchId,
    predictedScore1,
    predictedScore2,
  }).returning()

  return NextResponse.json(created[0], { status: 201 })
}
