import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { predictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, isPollaOpen, getPollaById, getPollaConfig } from '@/lib/polla'
import { autoFillGroupPrediction } from '@/lib/group-auto-fill'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requestedUserId = req.nextUrl.searchParams.get('userId') ?? session.userId
  if (myRole !== 'admin' && requestedUserId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(predictions)
    .where(and(eq(predictions.userId, requestedUserId), eq(predictions.pollaId, pollaId)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await isPollaOpen(pollaId))) {
    return NextResponse.json({ error: 'La polla está cerrada temporalmente' }, { status: 403 })
  }

  const { matchId, predictedScore1, predictedScore2 } = await req.json()
  if (typeof matchId !== 'number' || typeof predictedScore1 !== 'number' || typeof predictedScore2 !== 'number') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  if (predictedScore1 < 0 || predictedScore2 < 0 || predictedScore1 > 30 || predictedScore2 > 30) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 })
  }

  const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (match.length === 0) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  if (match[0].lockTime && new Date() >= match[0].lockTime) {
    return NextResponse.json({ error: 'Pronóstico cerrado para este partido' }, { status: 403 })
  }
  if (match[0].status !== 'SCHEDULED' && match[0].status !== 'TIMED') {
    return NextResponse.json({ error: 'Partido ya iniciado' }, { status: 403 })
  }
  if (!match[0].team1Resolved || !match[0].team2Resolved) {
    if (match[0].stage !== 'GROUP_STAGE') {
      return NextResponse.json({ error: 'Equipos aún no confirmados' }, { status: 403 })
    }
  }

  if (match[0].stage !== 'GROUP_STAGE') {
    const pollaConfig = await getPollaConfig(pollaId)
    if (pollaConfig['knockout_prediction_mode'] === 'sequential') {
      const stageOrder = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']
      const idx = stageOrder.indexOf(match[0].stage)
      if (idx > 0) {
        const prevStage = stageOrder[idx - 1]
        const prevMatches = await db.select({ status: matches.status }).from(matches).where(eq(matches.stage, prevStage))
        const allFinished = prevMatches.length > 0 && prevMatches.every(m => m.status === 'FINISHED')
        if (!allFinished) {
          return NextResponse.json({ error: 'Esta ronda aún no está disponible' }, { status: 403 })
        }
      }
    }
  }

  const existing = await db.select().from(predictions)
    .where(and(
      eq(predictions.userId, session.userId),
      eq(predictions.matchId, matchId),
      eq(predictions.pollaId, pollaId),
    ))
    .limit(1)

  if (existing.length > 0) {
    const updated = await db.update(predictions)
      .set({ predictedScore1, predictedScore2, updatedAt: new Date() })
      .where(eq(predictions.id, existing[0].id))
      .returning()

    if (match[0].stage === 'GROUP_STAGE' && match[0].groupName) {
      await autoFillGroupPrediction(pollaId, session.userId, match[0].groupName)
    }

    return NextResponse.json(updated[0])
  }

  const created = await db.insert(predictions).values({
    userId: session.userId,
    pollaId,
    matchId,
    predictedScore1,
    predictedScore2,
  }).returning()

  if (match[0].stage === 'GROUP_STAGE' && match[0].groupName) {
    await autoFillGroupPrediction(pollaId, session.userId, match[0].groupName)
  }

  return NextResponse.json(created[0], { status: 201 })
}
