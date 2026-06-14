import { db } from '@/lib/db'
import { matches, groupPredictions, groupStandings, groupStandingLocks, pollaMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole, getPollaConfig, isMemberPredictionUnlocked } from '@/lib/polla'
import { redirect } from 'next/navigation'
import GroupPredictionsForm from '@/components/predictions/GroupPredictionsForm'
import PredictionTabs from '@/components/predictions/PredictionTabs'
import ImportPredictionsButton from '@/components/predictions/ImportPredictionsButton'

export const revalidate = 60

export default async function PollaGroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [allMatches, myGroupPreds, standings, locks, myRole, config, predictionUnlocked] = await Promise.all([
    db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE')),
    db.select().from(groupPredictions).where(
      and(eq(groupPredictions.userId, session.userId), eq(groupPredictions.pollaId, polla.id))
    ),
    db.select().from(groupStandings),
    db.select({ groupName: groupStandingLocks.groupName }).from(groupStandingLocks),
    getMemberRole(polla.id, session.userId),
    getPollaConfig(polla.id),
    isMemberPredictionUnlocked(polla.id, session.userId),
  ])

  const lockedGroupNames = new Set(locks.map(l => l.groupName))

  const isAdmin = myRole === 'admin'
  const members = isAdmin
    ? await db.select({ id: users.id, name: users.name })
        .from(pollaMembers)
        .innerJoin(users, eq(pollaMembers.userId, users.id))
        .where(eq(pollaMembers.pollaId, polla.id))
    : []

  const groupsMap: Record<string, string[]> = {}
  for (const m of allMatches) {
    if (!m.groupName) continue
    if (!groupsMap[m.groupName]) groupsMap[m.groupName] = []
    if (!groupsMap[m.groupName].includes(m.team1)) groupsMap[m.groupName].push(m.team1)
    if (!groupsMap[m.groupName].includes(m.team2)) groupsMap[m.groupName].push(m.team2)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gradient-gold">Mis Pronósticos</h1>
        <ImportPredictionsButton pollaId={polla.id} isAdmin={isAdmin} members={members} />
      </div>

      <PredictionTabs active="groups" pollaSlug={slug} showQuestions={config['feature_custom_questions'] === 'true'} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Clasificados por Grupo</h2>
        <p className="text-muted-foreground text-sm">
          Predice quién termina 1°, 2° y 3° en cada grupo. Se cierra con el primer partido de cada grupo.
        </p>
        <div className="flex gap-3 text-xs">
          <span className="text-primary font-semibold">1° lugar: 6 pts</span>
          <span className="text-primary/70">2° lugar: 4 pts</span>
          <span className="text-primary/50">3° lugar: 2 pts</span>
        </div>
      </div>

      <GroupPredictionsForm
        groupsMap={groupsMap}
        initialPredictions={myGroupPreds}
        matches={allMatches}
        standings={standings}
        pollaId={polla.id}
        lockedGroupNames={[...lockedGroupNames]}
        predictionUnlocked={predictionUnlocked}
      />
    </div>
  )
}
