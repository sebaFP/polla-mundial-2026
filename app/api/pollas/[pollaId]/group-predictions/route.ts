import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupPredictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, isPollaOpen, getPollaById } from '@/lib/polla'

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

  const rows = await db.select().from(groupPredictions)
    .where(and(eq(groupPredictions.userId, requestedUserId), eq(groupPredictions.pollaId, pollaId)))
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

  const { groupName, firstPlace, secondPlace } = await req.json()
  if (!groupName || !firstPlace || !secondPlace) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }
  if (firstPlace === secondPlace) {
    return NextResponse.json({ error: 'Primer y segundo lugar deben ser diferentes' }, { status: 400 })
  }

  const firstGroupMatch = await db.select().from(matches)
    .where(and(eq(matches.groupName, groupName), eq(matches.stage, 'GROUP_STAGE')))

  if (firstGroupMatch.length > 0) {
    const firstMatchTime = firstGroupMatch.reduce((earliest, m) =>
      m.matchDatetime < earliest.matchDatetime ? m : earliest
    )
    if (firstMatchTime.lockTime && new Date() >= firstMatchTime.lockTime) {
      return NextResponse.json({ error: 'Pronósticos de grupo cerrados' }, { status: 403 })
    }
  }

  const existing = await db.select().from(groupPredictions)
    .where(and(
      eq(groupPredictions.userId, session.userId),
      eq(groupPredictions.groupName, groupName),
      eq(groupPredictions.pollaId, pollaId),
    ))
    .limit(1)

  if (existing.length > 0) {
    const updated = await db.update(groupPredictions)
      .set({ firstPlace, secondPlace })
      .where(eq(groupPredictions.id, existing[0].id))
      .returning()
    return NextResponse.json(updated[0])
  }

  const created = await db.insert(groupPredictions).values({
    userId: session.userId,
    pollaId,
    groupName,
    firstPlace,
    secondPlace,
  }).returning()

  return NextResponse.json(created[0], { status: 201 })
}
