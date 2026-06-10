import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupStandings, groupStandingLocks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'
import { recalcGroupPredictions } from '@/lib/football-data/sync'

type RouteContext = { params: Promise<{ pollaId: string; groupName: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, groupName } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [standings, lock] = await Promise.all([
    db.select().from(groupStandings).where(eq(groupStandings.groupName, groupName)),
    db.select().from(groupStandingLocks).where(eq(groupStandingLocks.groupName, groupName)).limit(1),
  ])

  const sorted = standings.sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    const aGD = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
    const bGD = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
    if (bGD !== aGD) return bGD - aGD
    return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
  })

  return NextResponse.json({
    groupName,
    teams: sorted,
    locked: lock.length > 0,
    lock: lock[0] ?? null,
  })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, groupName } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { firstPlace, secondPlace, thirdPlace } = await req.json()
  if (!firstPlace || !secondPlace) {
    return NextResponse.json({ error: 'firstPlace y secondPlace son requeridos' }, { status: 400 })
  }

  await db.insert(groupStandingLocks)
    .values({ groupName, firstPlace, secondPlace, thirdPlace: thirdPlace ?? null, lockedBy: session.userId })
    .onConflictDoUpdate({
      target: [groupStandingLocks.groupName],
      set: { firstPlace, secondPlace, thirdPlace: thirdPlace ?? null, lockedAt: new Date(), lockedBy: session.userId },
    })

  await recalcGroupPredictions(groupName)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, groupName } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(groupStandingLocks).where(eq(groupStandingLocks.groupName, groupName))

  await recalcGroupPredictions(groupName)

  return NextResponse.json({ ok: true })
}
