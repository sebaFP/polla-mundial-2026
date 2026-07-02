import { db } from '@/lib/db'
import { matches, predictions, groupStandings, groupStandingLocks, groupPredictions, pollas, pollaResultOverrides } from '@/lib/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getCompetitionMatches, isTeamResolved, type FDMatch } from './client'
import { calcMatchPoints, calcGroupPoints } from '@/lib/scoring'
import { getPollaConfig } from '@/lib/polla'

export type SyncResult = {
  seeded: number
  updated: number
  errors: string[]
}

export async function rebuildGroupStandings(groupName: string) {
  const finishedMatches = await db.select().from(matches)
    .where(and(
      eq(matches.stage, 'GROUP_STAGE'),
      eq(matches.groupName, groupName),
      eq(matches.status, 'FINISHED'),
    ))

  type Stats = { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number }
  const teamStats: Record<string, Stats> = {}
  const init = (): Stats => ({ played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 })

  for (const m of finishedMatches) {
    if (m.score1 === null || m.score2 === null) continue
    const s1 = m.score1, s2 = m.score2
    if (!teamStats[m.team1]) teamStats[m.team1] = init()
    if (!teamStats[m.team2]) teamStats[m.team2] = init()

    const r1: 'w' | 'd' | 'l' = s1 > s2 ? 'w' : s1 === s2 ? 'd' : 'l'
    const r2: 'w' | 'd' | 'l' = s2 > s1 ? 'w' : s1 === s2 ? 'd' : 'l'

    const applyResult = (stats: Stats, gf: number, ga: number, r: 'w' | 'd' | 'l') => {
      stats.played++
      stats.gf += gf
      stats.ga += ga
      if (r === 'w') { stats.won++; stats.pts += 3 }
      else if (r === 'd') { stats.drawn++; stats.pts += 1 }
      else stats.lost++
    }
    applyResult(teamStats[m.team1], s1, s2, r1)
    applyResult(teamStats[m.team2], s2, s1, r2)
  }

  await db.delete(groupStandings).where(eq(groupStandings.groupName, groupName))

  const rows = Object.entries(teamStats).map(([teamName, s]) => ({
    groupName,
    teamName,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    goalsFor: s.gf,
    goalsAgainst: s.ga,
    points: s.pts,
  }))

  if (rows.length > 0) {
    await db.insert(groupStandings).values(rows)
  }
}

async function recalcMatchPredictions(
  matchId: number, apiScore1: number, apiScore2: number,
  apiPenalties?: { home: number | null; away: number | null } | null,
) {
  const preds = await db.select().from(predictions).where(eq(predictions.matchId, matchId))

  // Load per-polla overrides — pollas with an override use their own scores instead of API
  const overrides = await db.select().from(pollaResultOverrides).where(eq(pollaResultOverrides.matchId, matchId))
  const overrideMap = new Map(overrides.map(o => [o.pollaId, o]))

  const pollaIds = [...new Set(preds.map(p => p.pollaId).filter(Boolean) as string[])]
  const configCache: Record<string, Record<string, string>> = {}
  for (const pid of pollaIds) {
    configCache[pid] = await getPollaConfig(pid)
  }

  const updatePromises = preds.map(async (pred) => {
    const config = pred.pollaId ? (configCache[pred.pollaId] ?? {}) : {}
    const override = pred.pollaId ? overrideMap.get(pred.pollaId) : undefined
    const score1 = override ? override.score1 : apiScore1
    const score2 = override ? override.score2 : apiScore2
    const penalties = override?.score1Penalties != null
      ? { home: override.score1Penalties, away: override.score2Penalties }
      : apiPenalties
    const pts = calcMatchPoints(pred.predictedScore1, pred.predictedScore2, score1, score2, config, penalties)

    if (pred.points !== pts) {
      await db.update(predictions)
        .set({ points: pts, updatedAt: new Date() })
        .where(eq(predictions.id, pred.id))
    }
  })
  await Promise.all(updatePromises)
}

export async function recalcGroupPredictions(groupName: string) {
  const [standings, lock] = await Promise.all([
    db.select().from(groupStandings).where(eq(groupStandings.groupName, groupName)),
    db.select().from(groupStandingLocks).where(eq(groupStandingLocks.groupName, groupName)).limit(1),
  ])

  const sorted = standings.sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    const aGD = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
    const bGD = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
    if (bGD !== aGD) return bGD - aGD
    return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
  })

  // Update position column in group_standings only if changed
  for (let i = 0; i < sorted.length; i++) {
    const newPos = i + 1
    if (sorted[i].position !== newPos) {
      await db.update(groupStandings)
        .set({ position: newPos })
        .where(eq(groupStandings.id, sorted[i].id))
    }
  }

  const hasLock = lock.length > 0

  // Count finished matches in the group to determine if it's complete (6 matches per group)
  const groupMatchCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(matches)
    .where(and(eq(matches.groupName, groupName), eq(matches.status, 'FINISHED')))
  const finishedCount = Number(groupMatchCount[0]?.count ?? 0)
  const groupComplete = finishedCount >= 6

  // Only score group predictions when group is fully played or admin has locked it
  if (!hasLock && !groupComplete) return

  const actualFirst = lock[0]?.firstPlace ?? sorted[0]?.teamName ?? ''
  const actualSecond = lock[0]?.secondPlace ?? sorted[1]?.teamName ?? ''

  const groupPreds = await db.select().from(groupPredictions)
    .where(eq(groupPredictions.groupName, groupName))

  const pollaIds = [...new Set(groupPreds.map(p => p.pollaId).filter(Boolean) as string[])]
  const configCache: Record<string, Record<string, string>> = {}
  for (const pid of pollaIds) {
    configCache[pid] = await getPollaConfig(pid)
  }

  const updatePromises = groupPreds.map(async (gp) => {
    const config = gp.pollaId ? (configCache[gp.pollaId] ?? {}) : {}
    const { pointsFirst, pointsSecond } = calcGroupPoints(
      gp.firstPlace, gp.secondPlace, actualFirst, actualSecond, config
    )
    if (gp.pointsFirst !== pointsFirst || gp.pointsSecond !== pointsSecond) {
      await db.update(groupPredictions)
        .set({ pointsFirst, pointsSecond })
        .where(eq(groupPredictions.id, gp.id))
    }
  })
  await Promise.all(updatePromises)
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
  force: boolean,
) {
  // Load all existing matches for this competition (by externalId and by id)
  const existingRows = await db.select({
    id:             matches.id,
    externalId:     matches.externalId,
    matchDatetime:  matches.matchDatetime,
    team1:          matches.team1,
    team2:          matches.team2,
    team1Resolved:  matches.team1Resolved,
    team2Resolved:  matches.team2Resolved,
    status:         matches.status,
    score1:         matches.score1,
    score2:         matches.score2,
    score1Ht:       matches.score1Ht,
    score2Ht:       matches.score2Ht,
    score1Penalties: matches.score1Penalties,
    score2Penalties: matches.score2Penalties,
    groupName:      matches.groupName,
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
      const isPenaltyShootout = fdm.score.duration === 'PENALTY_SHOOTOUT'
      const newScore1Penalties = isPenaltyShootout ? fdm.score.penalties?.home ?? null : null
      const newScore2Penalties = isPenaltyShootout ? fdm.score.penalties?.away ?? null : null
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

      const fdTeam1Resolved = isTeamResolved(fdm.homeTeam.name)
      const fdTeam2Resolved = isTeamResolved(fdm.awayTeam.name)

      if (existing) {
        // Keep old name if API still returns unresolved; upgrade when API provides real name
        const newTeam1 = fdTeam1Resolved ? fdm.homeTeam.name! : existing.team1
        const newTeam2 = fdTeam2Resolved ? fdm.awayTeam.name! : existing.team2
        const newTeam1Resolved = fdTeam1Resolved || !!existing.team1Resolved
        const newTeam2Resolved = fdTeam2Resolved || !!existing.team2Resolved

        const changed =
          existing.externalId !== externalId ||
          existing.status !== newStatus ||
          existing.score1 !== newScore1 ||
          existing.score2 !== newScore2 ||
          existing.score1Ht !== fdm.score.halfTime.home ||
          existing.score2Ht !== fdm.score.halfTime.away ||
          existing.score1Penalties !== newScore1Penalties ||
          existing.score2Penalties !== newScore2Penalties ||
          existing.team1 !== newTeam1 ||
          existing.team2 !== newTeam2 ||
          existing.team1Resolved !== newTeam1Resolved ||
          existing.team2Resolved !== newTeam2Resolved ||
          existing.groupName !== groupName

        if (!changed && !force) {
          continue
        }

        const [updated] = await db.update(matches)
          .set({
            status:        newStatus,
            score1:        newScore1,
            score2:        newScore2,
            score1Ht:      fdm.score.halfTime.home,
            score2Ht:      fdm.score.halfTime.away,
            score1Penalties: newScore1Penalties,
            score2Penalties: newScore2Penalties,
            groupName,
            team1:         newTeam1,
            team2:         newTeam2,
            team1Resolved: newTeam1Resolved,
            team2Resolved: newTeam2Resolved,
            lockTime,
            updatedAt:     new Date(),
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
          team1:         fdm.homeTeam.name ?? 'TBD',
          team2:         fdm.awayTeam.name ?? 'TBD',
          team1Resolved: fdTeam1Resolved,
          team2Resolved: fdTeam2Resolved,
          venue:         fdm.venue ?? null,
          status:        newStatus,
          score1:        newScore1,
          score2:        newScore2,
          score1Ht:      fdm.score.halfTime.home,
          score2Ht:      fdm.score.halfTime.away,
          score1Penalties: newScore1Penalties,
          score2Penalties: newScore2Penalties,
          lockTime,
        }).returning()
        upserted = inserted
        result.seeded++
      }

      if (!upserted) continue

      // Always recalculate predictions for finished matches (idempotent)
      if (newStatus === 'FINISHED' && newScore1 !== null && newScore2 !== null) {
        await recalcMatchPredictions(upserted.id, newScore1, newScore2, {
          home: upserted.score1Penalties, away: upserted.score2Penalties,
        })

        if (upserted.stage === 'GROUP_STAGE' && upserted.groupName) {
          await rebuildGroupStandings(upserted.groupName)
          await recalcGroupPredictions(upserted.groupName)
        }
      }
    } catch (err) {
      result.errors.push(`Match ${fdm.id}: ${String(err)}`)
    }
  }
}

export async function syncResults(options?: { force?: boolean }): Promise<SyncResult> {
  const result: SyncResult = { seeded: 0, updated: 0, errors: [] }
  const force = options?.force ?? false

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
        await syncCompetition(competitionCode, competitionId, result, force)
      } catch (err) {
        result.errors.push(`Competition ${competitionCode}: ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(String(err))
  }

  return result
}
