import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { predictions, groupPredictions, specialPredictions, matches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, isPollaOpen, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

type MatchPred = { matchNumber: number; team1: string; team2: string; score1: number; score2: number }
type GroupPred = { group: string; firstPlace: string; secondPlace: string; thirdPlace?: string }
type BonusPred = { type: string; value: string; isTeam: boolean }

function normalizeTeam(name: string): string {
  return name
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await isPollaOpen(pollaId))) {
    return NextResponse.json({ error: 'La polla está cerrada temporalmente' }, { status: 403 })
  }

  const body = await req.json()
  const { matchPredictions, groupPredictions: groupPreds, bonusPredictions, targetUserId } = body as {
    matchPredictions: MatchPred[]
    groupPredictions: GroupPred[]
    bonusPredictions: BonusPred[]
    targetUserId?: string
  }

  // Only admin can import for other users
  let userId = session.userId
  if (targetUserId && targetUserId !== session.userId) {
    if (myRole !== 'admin') {
      return NextResponse.json({ error: 'Solo admins pueden importar para otros usuarios' }, { status: 403 })
    }
    const targetRole = await getMemberRole(pollaId, targetUserId)
    if (!targetRole) return NextResponse.json({ error: 'Usuario no es miembro de esta polla' }, { status: 400 })
    userId = targetUserId
  }

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Match predictions: look up by team name pair (not by ID — DB serial ≠ Excel match number)
  if (Array.isArray(matchPredictions) && matchPredictions.length > 0) {
    const allMatches = await db.select().from(matches)

    // Build lookup: normalize(team1)|normalize(team2) → match (both orderings)
    const matchByTeams = new Map<string, typeof allMatches[0]>()
    for (const m of allMatches) {
      const k1 = normalizeTeam(m.team1) + '|' + normalizeTeam(m.team2)
      const k2 = normalizeTeam(m.team2) + '|' + normalizeTeam(m.team1)
      matchByTeams.set(k1, m)
      matchByTeams.set(k2, m)
    }

    for (const pred of matchPredictions) {
      const key = normalizeTeam(pred.team1) + '|' + normalizeTeam(pred.team2)
      const match = matchByTeams.get(key)

      if (!match) { skipped++; continue }
      if (match.lockTime && new Date() >= match.lockTime) { skipped++; continue }
      if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') { skipped++; continue }

      // Preserve score orientation: if team1 in Excel matches team1 in DB, use as-is; else swap
      const dbT1 = normalizeTeam(match.team1)
      const exT1 = normalizeTeam(pred.team1)
      const s1 = dbT1 === exT1 ? pred.score1 : pred.score2
      const s2 = dbT1 === exT1 ? pred.score2 : pred.score1

      try {
        await db.insert(predictions).values({
          userId,
          pollaId,
          matchId: match.id,
          predictedScore1: s1,
          predictedScore2: s2,
        }).onConflictDoUpdate({
          target: [predictions.userId, predictions.matchId, predictions.pollaId],
          set: { predictedScore1: s1, predictedScore2: s2, updatedAt: new Date() },
        })
        imported++
      } catch (e) {
        errors.push(`${pred.team1} vs ${pred.team2}: ${String(e)}`)
      }
    }
  }

  // Group predictions
  if (Array.isArray(groupPreds) && groupPreds.length > 0) {
    for (const pred of groupPreds) {
      const groupMatches = await db.select().from(matches)
        .where(and(eq(matches.groupName, pred.group), eq(matches.stage, 'GROUP_STAGE')))

      if (groupMatches.length > 0) {
        const first = groupMatches.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
        if (first.lockTime && new Date() >= new Date(first.lockTime)) { skipped++; continue }
      }

      try {
        await db.insert(groupPredictions).values({
          userId,
          pollaId,
          groupName: pred.group,
          firstPlace: pred.firstPlace,
          secondPlace: pred.secondPlace,
          thirdPlace: pred.thirdPlace ?? null,
        }).onConflictDoUpdate({
          target: [groupPredictions.userId, groupPredictions.groupName, groupPredictions.pollaId],
          set: {
            firstPlace: pred.firstPlace,
            secondPlace: pred.secondPlace,
            thirdPlace: pred.thirdPlace ?? null,
          },
        })
        imported++
      } catch (e) {
        errors.push(`Grupo ${pred.group}: ${String(e)}`)
      }
    }
  }

  // Bonus / special predictions
  if (Array.isArray(bonusPredictions) && bonusPredictions.length > 0) {
    const firstGroupMatch = await db.select().from(matches)
      .where(eq(matches.stage, 'GROUP_STAGE'))

    let bonusLocked = false
    if (firstGroupMatch.length > 0) {
      const first = firstGroupMatch.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
      bonusLocked = !!(first.lockTime && new Date() >= new Date(first.lockTime))
    }

    if (bonusLocked) {
      skipped += bonusPredictions.length
    } else {
      for (const pred of bonusPredictions) {
        try {
          await db.insert(specialPredictions).values({
            userId,
            pollaId,
            type: pred.type,
            teamName: pred.isTeam ? pred.value : null,
            playerName: pred.isTeam ? null : pred.value,
          }).onConflictDoUpdate({
            target: [specialPredictions.userId, specialPredictions.type, specialPredictions.pollaId],
            set: {
              teamName: pred.isTeam ? pred.value : null,
              playerName: pred.isTeam ? null : pred.value,
            },
          })
          imported++
        } catch (e) {
          errors.push(`Bonus ${pred.type}: ${String(e)}`)
        }
      }
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
