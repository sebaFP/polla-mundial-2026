import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupPredictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { isPollaOpen } from '@/lib/polla'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId') ?? session.userId
  if (session.role !== 'admin' && userId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(groupPredictions).where(eq(groupPredictions.userId, userId))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await isPollaOpen())) {
    return NextResponse.json({ error: 'La polla está cerrada temporalmente' }, { status: 403 })
  }

  const { groupName, firstPlace, secondPlace } = await req.json()
  if (!groupName || !firstPlace || !secondPlace) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }
  if (firstPlace === secondPlace) {
    return NextResponse.json({ error: 'Primer y segundo lugar deben ser diferentes' }, { status: 400 })
  }

  // Check if first match of group is locked
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
    .where(and(eq(groupPredictions.userId, session.userId), eq(groupPredictions.groupName, groupName)))
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
    groupName,
    firstPlace,
    secondPlace,
  }).returning()

  return NextResponse.json(created[0], { status: 201 })
}
