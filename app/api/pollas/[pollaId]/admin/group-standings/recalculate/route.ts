import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'
import { rebuildGroupStandings, recalcGroupPredictions } from '@/lib/football-data/sync'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const finishedGroupMatches = await db
    .selectDistinct({ groupName: matches.groupName })
    .from(matches)
    .where(and(eq(matches.stage, 'GROUP_STAGE'), eq(matches.status, 'FINISHED')))

  const groups = finishedGroupMatches
    .map(r => r.groupName)
    .filter((g): g is string => g !== null)

  for (const groupName of groups) {
    await rebuildGroupStandings(groupName)
    await recalcGroupPredictions(groupName)
  }

  return NextResponse.json({ ok: true, groups, updated: groups.length })
}
