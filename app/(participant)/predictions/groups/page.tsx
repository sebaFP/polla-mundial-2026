import { db } from '@/lib/db'
import { matches, groupPredictions, groupStandings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import GroupPredictionsForm from '@/components/predictions/GroupPredictionsForm'
import PredictionTabs from '@/components/predictions/PredictionTabs'

export const revalidate = 60

export default async function GroupPredictionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allMatches = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
  const myGroupPreds = await db.select().from(groupPredictions).where(eq(groupPredictions.userId, session.userId))
  const standings = await db.select().from(groupStandings)

  const groupsMap: Record<string, string[]> = {}
  for (const m of allMatches) {
    if (!m.groupName) continue
    if (!groupsMap[m.groupName]) groupsMap[m.groupName] = []
    if (!groupsMap[m.groupName].includes(m.team1)) groupsMap[m.groupName].push(m.team1)
    if (!groupsMap[m.groupName].includes(m.team2)) groupsMap[m.groupName].push(m.team2)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
      </div>

      <PredictionTabs active="groups" />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Clasificados por Grupo</h2>
        <p className="text-muted-foreground text-sm">
          Predice quién termina 1° y 2° en cada grupo. Se cierra con el primer partido de cada grupo.
        </p>
        <div className="flex gap-3 text-xs">
          <span className="text-primary font-semibold">1° lugar: 6 pts</span>
          <span className="text-primary/70">2° lugar: 4 pts</span>
        </div>
      </div>

      <GroupPredictionsForm
        groupsMap={groupsMap}
        initialPredictions={myGroupPreds}
        matches={allMatches}
        standings={standings}
      />
    </div>
  )
}
