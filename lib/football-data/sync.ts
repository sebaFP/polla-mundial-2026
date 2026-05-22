import { db } from '@/lib/db'
import { matches, predictions, groupStandings, groupPredictions, pollas } from '@/lib/db/schema'
import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { getCompetitionMatches, type FDMatch } from './client'
import { calcMatchPoints, calcGroupPoints } from '@/lib/scoring'
import { getPollaConfig } from '@/lib/polla'

export type SyncResult = {
  seeded: number
  updated: number
  errors: string[]
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

async function recalcMatchPredictions(matchId: number, score1: number, score2: number) {
  const preds = await db.select().from(predictions).where(eq(predictions.matchId, matchId))

  const pollaIds = [...new Set(preds.map(p => p.pollaId).filter(Boolean) as string[])]
  const configCache: Record<string, Record<string, string>> = {}
  for (const pid of pollaIds) {
    configCache[pid] = await getPollaConfig(pid)
  }

  for (const pred of preds) {
    const config = pred.pollaId ? (configCache[pred.pollaId] ?? {}) : {}
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config)
    await db.update(predictions)
      .set({ points: pts, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id))
  }
}

async function recalcGroupPredictions(groupName: string) {
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

  const pollaIds = [...new Set(groupPreds.map(p => p.pollaId).filter(Boolean) as string[])]
  const configCache: Record<string, Record<string, string>> = {}
  for (const pid of pollaIds) {
    configCache[pid] = await getPollaConfig(pid)
  }

  for (const gp of groupPreds) {
    const config = gp.pollaId ? (configCache[gp.pollaId] ?? {}) : {}
    const { pointsFirst, pointsSecond } = calcGroupPoints(
      gp.firstPlace, gp.secondPlace, actualFirst, actualSecond, config
    )
    await db.update(groupPredictions)
      .set({ pointsFirst, pointsSecond })
      .where(eq(groupPredictions.id, gp.id))
  }
}

// Normalize FD API group names ("Group A") to DB format ("GROUP_A")
function normalizeGroup(group: string | null): string | null {
  if (!group) return null
  return group.toUpperCase().replace(/ /g, '_')
}

async function syncCompetition(
  competitionCode: string,
  competitionId: number,
  result: SyncResult,
) {
  // Load all existing matches for this competition (by externalId and by id)
  const existingRows = await db.select({
    id:           matches.id,
    externalId:   matches.externalId,
    matchDatetime: matches.matchDatetime,
    team1:        matches.team1,
    team2:        matches.team2,
  }).from(matches).where(eq(matches.competitionId, competitionId))

  // Index by externalId for fast lookup
  const byExternalId = new Map(existingRows.filter(r => r.externalId).map(r => [r.externalId!, r]))

  // Index by "date+team1+team2" to detect seeded rows with fake externalIds
  const byTeamDate = new Map(existingRows.map(r => {
    const d = r.matchDatetime ? new Date(r.matchDatetime).toISOString().slice(0, 16) : ''
    return [`${d}|${r.team1}|${r.team2}`, r]
  }))

  const fdMatches = await getCompetitionMatches(competitionCode)

  for (const fdm of fdMatches) {
    try {
      const externalId = String(fdm.id)
      const matchDatetime = new Date(fdm.utcDate)
      const lockTime = new Date(matchDatetime.getTime() - 15 * 60 * 1000)
      const newScore1 = fdm.score.fullTime.home
      const newScore2 = fdm.score.fullTime.away
      const newStatus = fdm.status
      const groupName = normalizeGroup(fdm.group)

      // Check if already tracked by externalId
      let existing = byExternalId.get(externalId) ?? null

      // If not, check if a seeded row exists with same date+teams (fake externalId)
      if (!existing) {
        const dateKey = `${matchDatetime.toISOString().slice(0, 16)}|${fdm.homeTeam.name}|${fdm.awayTeam.name}`
        existing = byTeamDate.get(dateKey) ?? null
        if (existing) {
          // Migrate: stamp this row with the real FD externalId so future syncs find it directly
          await db.update(matches)
            .set({ externalId, competitionId, updatedAt: new Date() })
            .where(eq(matches.id, existing.id))
          byExternalId.set(externalId, existing)
        }
      }

      let upserted: typeof matches.$inferSelect | undefined

      if (existing) {
        // Update existing row
        const [updated] = await db.update(matches)
          .set({
            status:    newStatus,
            score1:    newScore1,
            score2:    newScore2,
            score1Ht:  fdm.score.halfTime.home,
            score2Ht:  fdm.score.halfTime.away,
            groupName,
            updatedAt: new Date(),
          })
          .where(eq(matches.id, existing.id))
          .returning()
        upserted = updated
        result.updated++
      } else {
        // Insert new row
        const [inserted] = await db.insert(matches).values({
          externalId,
          competitionId,
          stage:         fdm.stage,
          groupName,
          matchday:      fdm.matchday ?? null,
          matchDatetime,
          team1:         fdm.homeTeam.name,
          team2:         fdm.awayTeam.name,
          team1Resolved: true,
          team2Resolved: true,
          venue:         fdm.venue ?? null,
          status:        newStatus,
          score1:        newScore1,
          score2:        newScore2,
          score1Ht:      fdm.score.halfTime.home,
          score2Ht:      fdm.score.halfTime.away,
          lockTime,
        }).returning()
        upserted = inserted
        result.seeded++
      }

      if (!upserted) continue

      // Always recalculate predictions for finished matches (idempotent)
      if (newStatus === 'FINISHED' && newScore1 !== null && newScore2 !== null) {
        await recalcMatchPredictions(upserted.id, newScore1, newScore2)

        if (upserted.stage === 'GROUP_STAGE' && upserted.groupName) {
          await updateGroupStandings(upserted.groupName, upserted.team1, upserted.team2, newScore1, newScore2)
          await recalcGroupPredictions(upserted.groupName)
        }
      }
    } catch (err) {
      result.errors.push(`Match ${fdm.id}: ${String(err)}`)
    }
  }
}

export async function syncResults(): Promise<SyncResult> {
  const result: SyncResult = { seeded: 0, updated: 0, errors: [] }

  try {
    // Get distinct competitions used by active pollas
    const activePollas = await db.select({
      competitionCode: pollas.competitionCode,
      competitionId:   pollas.competitionId,
    }).from(pollas).where(eq(pollas.isActive, true))

    // Deduplicate by competition code
    const seen = new Set<string>()
    const competitions: { competitionCode: string; competitionId: number }[] = []
    for (const p of activePollas) {
      const code = p.competitionCode ?? 'WC'
      if (!seen.has(code)) {
        seen.add(code)
        competitions.push({ competitionCode: code, competitionId: p.competitionId ?? 2000 })
      }
    }

    // Fallback: if no active pollas, still sync WC (backwards compat)
    if (competitions.length === 0) {
      competitions.push({ competitionCode: 'WC', competitionId: 2000 })
    }

    for (const { competitionCode, competitionId } of competitions) {
      try {
        await syncCompetition(competitionCode, competitionId, result)
      } catch (err) {
        result.errors.push(`Competition ${competitionCode}: ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(String(err))
  }

  return result
}
