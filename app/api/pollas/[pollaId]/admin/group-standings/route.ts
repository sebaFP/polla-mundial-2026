import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupStandings, groupStandingLocks } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [allStandings, allLocks] = await Promise.all([
    db.select().from(groupStandings),
    db.select().from(groupStandingLocks),
  ])

  const lockMap = new Map(allLocks.map(l => [l.groupName, l]))

  const byGroup: Record<string, typeof allStandings> = {}
  for (const row of allStandings) {
    if (!byGroup[row.groupName]) byGroup[row.groupName] = []
    byGroup[row.groupName].push(row)
  }

  const result = Object.entries(byGroup).map(([groupName, teams]) => {
    const sorted = teams.sort((a, b) => {
      if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
      const aGD = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
      const bGD = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
      if (bGD !== aGD) return bGD - aGD
      return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
    })
    const lock = lockMap.get(groupName) ?? null
    return { groupName, teams: sorted, locked: !!lock, lock }
  }).sort((a, b) => a.groupName.localeCompare(b.groupName))

  return NextResponse.json(result)
}
