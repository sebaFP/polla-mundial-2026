import { db } from '@/lib/db'
import { groupStandings, groupStandingLocks } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug } from '@/lib/polla'
import { redirect } from 'next/navigation'
import GroupStandingsManager from '@/components/admin/GroupStandingsManager'

export const revalidate = 0

export default async function AdminGroupStandingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

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

  const groups = Object.entries(byGroup).map(([groupName, teams]) => {
    const sorted = teams.sort((a, b) => {
      if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
      const aGD = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
      const bGD = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
      if (bGD !== aGD) return bGD - aGD
      return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
    })
    const lock = lockMap.get(groupName)
    return {
      groupName,
      teams: sorted,
      locked: !!lock,
      lock: lock ? {
        firstPlace: lock.firstPlace,
        secondPlace: lock.secondPlace,
        thirdPlace: lock.thirdPlace ?? null,
        lockedAt: lock.lockedAt?.toISOString() ?? null,
      } : null,
    }
  }).sort((a, b) => a.groupName.localeCompare(b.groupName))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Clasificación de Grupos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Se calcula automáticamente desde los resultados. Fija manualmente para empates técnicos o ajustes.
        </p>
      </div>
      <GroupStandingsManager initialGroups={groups} pollaId={polla.id} />
    </div>
  )
}
