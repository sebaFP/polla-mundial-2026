import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupPredictions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'
import { autoFillGroupPrediction } from '@/lib/group-auto-fill'

type RouteContext = { params: Promise<{ pollaId: string; groupName: string }> }

// Reset manual override — recalculates from user's match predictions
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId, groupName } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Clear the manual override flag and delete so auto-fill can recreate
  await db.delete(groupPredictions)
    .where(and(
      eq(groupPredictions.userId, session.userId),
      eq(groupPredictions.pollaId, pollaId),
      eq(groupPredictions.groupName, groupName),
    ))

  await autoFillGroupPrediction(pollaId, session.userId, groupName)

  const updated = await db.select().from(groupPredictions)
    .where(and(
      eq(groupPredictions.userId, session.userId),
      eq(groupPredictions.pollaId, pollaId),
      eq(groupPredictions.groupName, groupName),
    ))
    .limit(1)

  return NextResponse.json(updated[0] ?? null)
}
