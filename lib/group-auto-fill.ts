import { db } from '@/lib/db'
import { matches, predictions, groupPredictions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

type Standings = { first: string; second: string; third: string } | null

export function computeGroupStandingsFromPredictions(
  groupMatches: { id: number; team1: string; team2: string }[],
  userPreds: { matchId: number; predictedScore1: number; predictedScore2: number }[],
): Standings {
  const predMap = new Map(userPreds.map(p => [p.matchId, p]))

  type Stats = { pts: number; gf: number; ga: number }
  const stats: Record<string, Stats> = {}

  for (const m of groupMatches) {
    const pred = predMap.get(m.id)
    if (!pred) continue

    if (!stats[m.team1]) stats[m.team1] = { pts: 0, gf: 0, ga: 0 }
    if (!stats[m.team2]) stats[m.team2] = { pts: 0, gf: 0, ga: 0 }

    const s1 = pred.predictedScore1, s2 = pred.predictedScore2
    stats[m.team1].gf += s1; stats[m.team1].ga += s2
    stats[m.team2].gf += s2; stats[m.team2].ga += s1

    if (s1 > s2) { stats[m.team1].pts += 3 }
    else if (s2 > s1) { stats[m.team2].pts += 3 }
    else { stats[m.team1].pts += 1; stats[m.team2].pts += 1 }
  }

  const sorted = Object.entries(stats).sort(([, a], [, b]) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    const aGD = a.gf - a.ga, bGD = b.gf - b.ga
    if (bGD !== aGD) return bGD - aGD
    return b.gf - a.gf
  })

  if (sorted.length < 2) return null
  return {
    first: sorted[0][0],
    second: sorted[1][0],
    third: sorted[2]?.[0] ?? '',
  }
}

export async function autoFillGroupPrediction(
  pollaId: string,
  userId: string,
  groupName: string,
) {
  const [groupMatches, userPreds] = await Promise.all([
    db.select({ id: matches.id, team1: matches.team1, team2: matches.team2 })
      .from(matches)
      .where(and(eq(matches.stage, 'GROUP_STAGE'), eq(matches.groupName, groupName))),
    db.select({ matchId: predictions.matchId, predictedScore1: predictions.predictedScore1, predictedScore2: predictions.predictedScore2 })
      .from(predictions)
      .where(and(eq(predictions.userId, userId), eq(predictions.pollaId, pollaId))),
  ])

  const computed = computeGroupStandingsFromPredictions(groupMatches, userPreds)
  if (!computed) return

  const existing = await db.select({ id: groupPredictions.id, isManualOverride: groupPredictions.isManualOverride })
    .from(groupPredictions)
    .where(and(
      eq(groupPredictions.userId, userId),
      eq(groupPredictions.pollaId, pollaId),
      eq(groupPredictions.groupName, groupName),
    ))
    .limit(1)

  // Don't overwrite manual overrides
  if (existing[0]?.isManualOverride) return

  if (existing.length > 0) {
    await db.update(groupPredictions)
      .set({ firstPlace: computed.first, secondPlace: computed.second, thirdPlace: computed.third || null })
      .where(eq(groupPredictions.id, existing[0].id))
  } else {
    await db.insert(groupPredictions).values({
      userId,
      pollaId,
      groupName,
      firstPlace: computed.first,
      secondPlace: computed.second,
      thirdPlace: computed.third || null,
      isManualOverride: false,
    })
  }
}
