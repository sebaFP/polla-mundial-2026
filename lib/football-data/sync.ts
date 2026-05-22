import { db } from '@/lib/db'
import { matches, predictions, groupStandings, groupPredictions, tournamentConfig } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getActiveWCMatches, type FDMatch } from './client'
import { calcMatchPoints, calcGroupPoints } from '@/lib/scoring'

export type SyncResult = {
  updated: number
  errors: string[]
}

async function getConfig(): Promise<Record<string, string>> {
  const rows = await db.select().from(tournamentConfig)
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function updateGroupStandings(groupName: string, team1: string, team2: string, score1: number, score2: number) {
  const updateTeam = async (team: string, gf: number, ga: number, result: 'w' | 'd' | 'l') => {
    const won = result === 'w' ? 1 : 0
    const drawn = result === 'd' ? 1 : 0
    const lost = result === 'l' ? 1 : 0
    const pts = won * 3 + drawn

    const existing = await db.select().from(groupStandings)
      .where(and(eq(groupStandings.groupName, groupName), eq(groupStandings.teamName, team)))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(groupStandings).values({
        groupName,
        teamName: team,
        played: 1,
        won,
        drawn,
        lost,
        goalsFor: gf,
        goalsAgainst: ga,
        points: pts,
      })
    } else {
      await db.update(groupStandings)
        .set({
          played: sql`${groupStandings.played} + 1`,
          won: sql`${groupStandings.won} + ${won}`,
          drawn: sql`${groupStandings.drawn} + ${drawn}`,
          lost: sql`${groupStandings.lost} + ${lost}`,
          goalsFor: sql`${groupStandings.goalsFor} + ${gf}`,
          goalsAgainst: sql`${groupStandings.goalsAgainst} + ${ga}`,
          points: sql`${groupStandings.points} + ${pts}`,
          updatedAt: new Date(),
        })
        .where(and(eq(groupStandings.groupName, groupName), eq(groupStandings.teamName, team)))
    }
  }

  const result1: 'w' | 'd' | 'l' = score1 > score2 ? 'w' : score1 === score2 ? 'd' : 'l'
  const result2: 'w' | 'd' | 'l' = score2 > score1 ? 'w' : score1 === score2 ? 'd' : 'l'

  await Promise.all([
    updateTeam(team1, score1, score2, result1),
    updateTeam(team2, score2, score1, result2),
  ])
}

async function recalcMatchPredictions(matchId: number, score1: number, score2: number, config: Record<string, string>) {
  const preds = await db.select().from(predictions).where(eq(predictions.matchId, matchId))
  for (const pred of preds) {
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config)
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }
}

async function recalcGroupPredictions(groupName: string, config: Record<string, string>) {
  const standings = await db.select().from(groupStandings)
    .where(eq(groupStandings.groupName, groupName))

  const sorted = standings.sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    const aGD = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
    const bGD = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
    if (bGD !== aGD) return bGD - aGD
    return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
  })

  const actualFirst = sorted[0]?.teamName ?? ''
  const actualSecond = sorted[1]?.teamName ?? ''

  const groupPreds = await db.select().from(groupPredictions)
    .where(eq(groupPredictions.groupName, groupName))

  for (const gp of groupPreds) {
    const { pointsFirst, pointsSecond } = calcGroupPoints(
      gp.firstPlace, gp.secondPlace, actualFirst, actualSecond, config
    )
    await db.update(groupPredictions)
      .set({ pointsFirst, pointsSecond })
      .where(eq(groupPredictions.id, gp.id))
  }
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, errors: [] }

  try {
    const config = await getConfig()
    const fdMatches = await getActiveWCMatches()

    for (const fdm of fdMatches) {
      try {
        const existing = await db.select().from(matches)
          .where(eq(matches.externalId, String(fdm.id)))
          .limit(1)

        if (existing.length === 0) continue

        const match = existing[0]
        const newScore1 = fdm.score.fullTime.home
        const newScore2 = fdm.score.fullTime.away
        const newStatus = fdm.status

        // Skip if nothing changed
        if (
          match.status === newStatus &&
          match.score1 === newScore1 &&
          match.score2 === newScore2
        ) continue

        await db.update(matches)
          .set({
            status: newStatus,
            score1: newScore1,
            score2: newScore2,
            score1Ht: fdm.score.halfTime.home,
            score2Ht: fdm.score.halfTime.away,
            updatedAt: new Date(),
          })
          .where(eq(matches.id, match.id))

        if (newStatus === 'FINISHED' && newScore1 !== null && newScore2 !== null) {
          await recalcMatchPredictions(match.id, newScore1, newScore2, config)

          if (match.stage === 'GROUP_STAGE' && match.groupName) {
            await updateGroupStandings(match.groupName, match.team1, match.team2, newScore1, newScore2)
            await recalcGroupPredictions(match.groupName, config)
          }
        }

        result.updated++
      } catch (err) {
        result.errors.push(`Match ${fdm.id}: ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(String(err))
  }

  return result
}
