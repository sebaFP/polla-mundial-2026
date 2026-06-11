import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, predictions, groupPredictions, specialPredictions, pollaMembers, pollaAnswers, matches, pollaResultOverrides, groupStandings, groupStandingLocks } from '@/lib/db/schema'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { calcMatchPoints } from '@/lib/scoring'

export type LeaderboardEntry = {
  userId: string
  name: string
  avatarColor: string | null
  role: string
  matchPoints: number       // confirmed (synced FINISHED)
  pendingPoints: number     // FINISHED but sync hasn't run yet
  livePoints: number        // IN_PLAY / PAUSED current score
  liveGroupPoints: number   // tentative group prediction points (groups not yet locked)
  groupPoints: number
  specialPoints: number
  questionPoints: number
  totalPoints: number       // matchPoints + pendingPoints + groupPoints + specialPoints + questionPoints
  rank: number
  predictedMatches: number
  scoredMatches: number
  hasLiveMatches: boolean
  hasLiveGroups: boolean
}

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const matchPts = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
      predicted: sql<number>`COUNT(${predictions.id})`,
      scored: sql<number>`COUNT(CASE WHEN ${predictions.points} IS NOT NULL THEN 1 END)`,
    })
    .from(predictions)
    .where(eq(predictions.pollaId, pollaId))
    .groupBy(predictions.userId)

  const groupPts = await db
    .select({
      userId: groupPredictions.userId,
      total: sql<number>`COALESCE(SUM(COALESCE(${groupPredictions.pointsFirst}, 0) + COALESCE(${groupPredictions.pointsSecond}, 0)), 0)`,
    })
    .from(groupPredictions)
    .where(eq(groupPredictions.pollaId, pollaId))
    .groupBy(groupPredictions.userId)

  const specialPts = await db
    .select({
      userId: specialPredictions.userId,
      total: sql<number>`COALESCE(SUM(${specialPredictions.points}), 0)`,
    })
    .from(specialPredictions)
    .where(eq(specialPredictions.pollaId, pollaId))
    .groupBy(specialPredictions.userId)

  const members = await db.select({
    userId: pollaMembers.userId,
    role: pollaMembers.role,
    inscriptionStatus: pollaMembers.inscriptionStatus,
    name: users.name,
    avatarColor: users.avatarColor,
  })
    .from(pollaMembers)
    .innerJoin(users, eq(pollaMembers.userId, users.id))
    .where(and(
      eq(pollaMembers.pollaId, pollaId),
      sql`(${pollaMembers.role} = 'participant' OR (${pollaMembers.role} = 'admin' AND ${pollaMembers.inscriptionStatus} = 'approved'))`
    ))

  const questionPts = await db
    .select({
      userId: pollaAnswers.userId,
      total: sql<number>`COALESCE(SUM(${pollaAnswers.points}), 0)`,
    })
    .from(pollaAnswers)
    .where(eq(pollaAnswers.pollaId, pollaId))
    .groupBy(pollaAnswers.userId)

  // --- Live & unsynced points ---
  // Fetch matches that are in-play or finished (to catch unsynced finished matches)
  const activeMatches = await db.select().from(matches)
    .where(sql`${matches.status} IN ('IN_PLAY', 'PAUSED', 'FINISHED')`)

  const activeMatchIds = activeMatches
    .filter(m => m.score1 !== null && m.score2 !== null)
    .map(m => m.id)

  const pendingPtsMap: Record<string, number> = {}
  const livePtsMap: Record<string, number> = {}
  let hasLive = false

  const config = await getPollaConfig(pollaId)

  if (activeMatchIds.length > 0) {
    const [livePreds, overrides] = await Promise.all([
      db.select().from(predictions).where(and(
        eq(predictions.pollaId, pollaId),
        inArray(predictions.matchId, activeMatchIds),
      )),
      db.select().from(pollaResultOverrides).where(and(
        eq(pollaResultOverrides.pollaId, pollaId),
        inArray(pollaResultOverrides.matchId, activeMatchIds),
      )),
    ])

    const overrideMap = new Map(overrides.map(o => [o.matchId, o]))
    const matchMap = new Map(activeMatches.map(m => [m.id, m]))

    for (const pred of livePreds) {
      const match = matchMap.get(pred.matchId)
      if (!match || match.score1 === null || match.score2 === null) continue

      const override = overrideMap.get(pred.matchId)
      const s1 = override ? override.score1 : match.score1
      const s2 = override ? override.score2 : match.score2
      const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, s1, s2, config)

      if (match.status === 'FINISHED') {
        // Only count if not already synced into predictions.points
        if (pred.points === null || pred.points === undefined) {
          pendingPtsMap[pred.userId] = (pendingPtsMap[pred.userId] ?? 0) + pts
        }
      } else {
        // IN_PLAY or PAUSED — always recalculate from current score
        hasLive = true
        livePtsMap[pred.userId] = (livePtsMap[pred.userId] ?? 0) + pts
      }
    }
  }

  // --- Live group prediction points ---
  // For groups not yet locked (finalized), compute tentative 1st/2nd from current standings
  const [locks, standings, allGroupPreds] = await Promise.all([
    db.select().from(groupStandingLocks),
    db.select().from(groupStandings),
    db.select().from(groupPredictions).where(eq(groupPredictions.pollaId, pollaId)),
  ])
  const lockedGroups = new Set(locks.map(l => l.groupName))
  const ptGroupWinner = parseInt(config.points_group_winner ?? '6') || 6
  const ptGroupRunnerUp = parseInt(config.points_group_runner_up ?? '4') || 4

  // Build current 1st/2nd per unlocked group from standings (sorted by position)
  const currentGroupLeaders: Record<string, { first: string; second: string }> = {}
  const byGroup: Record<string, typeof standings> = {}
  for (const s of standings) {
    if (!byGroup[s.groupName]) byGroup[s.groupName] = []
    byGroup[s.groupName].push(s)
  }
  for (const [group, rows] of Object.entries(byGroup)) {
    if (lockedGroups.has(group)) continue
    const sorted = rows.slice().sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    if (sorted.length >= 2 && sorted[0].played && sorted[0].played > 0) {
      currentGroupLeaders[group] = { first: sorted[0].teamName, second: sorted[1].teamName }
    }
  }

  const liveGroupPtsMap: Record<string, number> = {}
  // hasLiveGroups = true whenever any group prediction is still unscored and the group isn't locked
  const hasLiveGroups = allGroupPreds.some(
    p => !lockedGroups.has(p.groupName) && (p.pointsFirst === null || p.pointsFirst === undefined)
  )

  for (const pred of allGroupPreds) {
    if (lockedGroups.has(pred.groupName)) continue
    // Already scored → skip (will be in groupPoints)
    if (pred.pointsFirst !== null && pred.pointsFirst !== undefined) continue
    const leaders = currentGroupLeaders[pred.groupName]
    if (!leaders) continue
    let tentative = 0
    if (pred.firstPlace === leaders.first) tentative += ptGroupWinner
    if (pred.secondPlace === leaders.second) tentative += ptGroupRunnerUp
    if (tentative > 0) {
      liveGroupPtsMap[pred.userId] = (liveGroupPtsMap[pred.userId] ?? 0) + tentative
    }
  }

  const matchMap2 = Object.fromEntries(matchPts.map(r => [r.userId, r]))
  const groupMap = Object.fromEntries(groupPts.map(r => [r.userId, r]))
  const specialMap = Object.fromEntries(specialPts.map(r => [r.userId, r]))
  const questionMap = Object.fromEntries(questionPts.map(r => [r.userId, r]))

  const entries: LeaderboardEntry[] = members.map(m => {
    const mp = matchMap2[m.userId]
    const gp = groupMap[m.userId]
    const sp = specialMap[m.userId]
    const qp = questionMap[m.userId]
    const matchPoints = Number(mp?.total ?? 0)
    const pendingPoints = pendingPtsMap[m.userId] ?? 0
    const livePoints = livePtsMap[m.userId] ?? 0
    const liveGroupPoints = liveGroupPtsMap[m.userId] ?? 0
    const groupPoints = Number(gp?.total ?? 0)
    const specialPoints = Number(sp?.total ?? 0)
    const questionPoints = Number(qp?.total ?? 0)
    return {
      userId: m.userId,
      name: m.name,
      avatarColor: m.avatarColor,
      role: m.role,
      matchPoints,
      pendingPoints,
      livePoints,
      liveGroupPoints,
      groupPoints,
      specialPoints,
      questionPoints,
      // Rank by confirmed + pending + live so ranking moves during matches
      totalPoints: matchPoints + pendingPoints + livePoints + liveGroupPoints + groupPoints + specialPoints + questionPoints,
      rank: 0,
      predictedMatches: Number(mp?.predicted ?? 0),
      scoredMatches: Number(mp?.scored ?? 0),
      hasLiveMatches: hasLive,
      hasLiveGroups,
    }
  })

  entries.sort((a, b) => b.totalPoints - a.totalPoints)
  entries.forEach((e, i) => { e.rank = i + 1 })

  return NextResponse.json(entries)
}
