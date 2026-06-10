import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { predictions, groupPredictions, specialPredictions, pollaAnswers, pollaQuestions, pollaQuestionOptions, matches } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, isPollaOpen, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

// Types that are stored as teamName in specialPredictions
const TEAM_SPECIAL_TYPES = new Set([
  'champion', 'finalist', 'third',
  'bonus_most_goals_team', 'bonus_most_conceded_team',
])

type MatchPred       = { matchId: number; score1: number; score2: number }
type GroupPred       = { key: string; team: string }
type SpecialPred     = { type: string; value: string }
type QAns            = { questionId: string; answer: string }

// Legacy (Copa Mundial FIFA 2026 template) types
type LegacyMatchPred = { matchNumber: number; team1: string; team2: string; score1: number; score2: number }
type LegacyGroupPred = { group: string; firstPlace: string; secondPlace: string; thirdPlace?: string }
type LegacyBonusPred = { type: string; value: string; isTeam: boolean }

function normalizeTeam(name: string): string {
  return name.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
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
  const { legacy, targetUserId } = body as { legacy?: boolean; targetUserId?: string }

  // Admin can import for other users
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

  if (legacy) {
    // ── LEGACY: Copa Mundial FIFA 2026 template (team-name lookup) ───────────────
    const {
      matchPredictions: legacyMatches,
      groupPredictions: legacyGroups,
      bonusPredictions: legacyBonus,
    } = body as {
      matchPredictions: LegacyMatchPred[]
      groupPredictions: LegacyGroupPred[]
      bonusPredictions: LegacyBonusPred[]
    }

    if (Array.isArray(legacyMatches) && legacyMatches.length > 0) {
      const allMatches = await db.select().from(matches)
      const matchByTeams = new Map<string, typeof allMatches[0]>()
      for (const m of allMatches) {
        matchByTeams.set(normalizeTeam(m.team1) + '|' + normalizeTeam(m.team2), m)
        matchByTeams.set(normalizeTeam(m.team2) + '|' + normalizeTeam(m.team1), m)
      }
      for (const pred of legacyMatches) {
        const match = matchByTeams.get(normalizeTeam(pred.team1) + '|' + normalizeTeam(pred.team2))
        if (!match) { skipped++; continue }
        if (match.lockTime && new Date() >= match.lockTime) { skipped++; continue }
        if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') { skipped++; continue }
        const dbT1 = normalizeTeam(match.team1)
        const exT1 = normalizeTeam(pred.team1)
        const s1 = dbT1 === exT1 ? pred.score1 : pred.score2
        const s2 = dbT1 === exT1 ? pred.score2 : pred.score1
        try {
          await db.insert(predictions).values({ userId, pollaId, matchId: match.id, predictedScore1: s1, predictedScore2: s2 })
            .onConflictDoUpdate({
              target: [predictions.userId, predictions.matchId, predictions.pollaId],
              set: { predictedScore1: s1, predictedScore2: s2, updatedAt: new Date() },
            })
          imported++
        } catch (e) { errors.push(`${pred.team1} vs ${pred.team2}: ${String(e)}`) }
      }
    }

    if (Array.isArray(legacyGroups) && legacyGroups.length > 0) {
      const allGroupMatches = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
      for (const pred of legacyGroups) {
        const gms = allGroupMatches.filter(m => m.groupName === pred.group)
        if (gms.length > 0) {
          const first = gms.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
          if (first.lockTime && new Date() >= new Date(first.lockTime)) { skipped++; continue }
        }
        try {
          await db.insert(groupPredictions).values({ userId, pollaId, groupName: pred.group, firstPlace: pred.firstPlace, secondPlace: pred.secondPlace, thirdPlace: pred.thirdPlace ?? null })
            .onConflictDoUpdate({
              target: [groupPredictions.userId, groupPredictions.groupName, groupPredictions.pollaId],
              set: { firstPlace: pred.firstPlace, secondPlace: pred.secondPlace, thirdPlace: pred.thirdPlace ?? null },
            })
          imported++
        } catch (e) { errors.push(`Grupo ${pred.group}: ${String(e)}`) }
      }
    }

    if (Array.isArray(legacyBonus) && legacyBonus.length > 0) {
      const gms = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
      let bonusLocked = false
      if (gms.length > 0) {
        const earliest = gms.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
        bonusLocked = !!(earliest.lockTime && new Date() >= new Date(earliest.lockTime))
      }
      if (bonusLocked) {
        skipped += legacyBonus.length
      } else {
        for (const pred of legacyBonus) {
          try {
            await db.insert(specialPredictions).values({ userId, pollaId, type: pred.type, teamName: pred.isTeam ? pred.value : null, playerName: pred.isTeam ? null : pred.value })
              .onConflictDoUpdate({
                target: [specialPredictions.userId, specialPredictions.type, specialPredictions.pollaId],
                set: { teamName: pred.isTeam ? pred.value : null, playerName: pred.isTeam ? null : pred.value },
              })
            imported++
          } catch (e) { errors.push(`Bonus ${pred.type}: ${String(e)}`) }
        }
      }
    }
  } else {
    // ── V2: Official template (ID-based lookup) ────────────────────────────────
    const {
      matchPredictions: matchPreds,
      groupPredictions: groupPreds,
      specialPredictions: specialPreds,
      bonusPredictions,
      questionAnswers,
    } = body as {
      matchPredictions: MatchPred[]
      groupPredictions: GroupPred[]
      specialPredictions: SpecialPred[]
      bonusPredictions: SpecialPred[]
      questionAnswers: QAns[]
    }

    if (Array.isArray(matchPreds) && matchPreds.length > 0) {
      const ids = matchPreds.map(p => p.matchId)
      const dbMatches = await db.select().from(matches).where(inArray(matches.id, ids))
      const matchById = new Map(dbMatches.map(m => [m.id, m]))
      for (const pred of matchPreds) {
        const match = matchById.get(pred.matchId)
        if (!match) { skipped++; continue }
        if (match.lockTime && new Date() >= match.lockTime) { skipped++; continue }
        if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') { skipped++; continue }
        try {
          await db.insert(predictions).values({ userId, pollaId, matchId: match.id, predictedScore1: pred.score1, predictedScore2: pred.score2 })
            .onConflictDoUpdate({
              target: [predictions.userId, predictions.matchId, predictions.pollaId],
              set: { predictedScore1: pred.score1, predictedScore2: pred.score2, updatedAt: new Date() },
            })
          imported++
        } catch (e) { errors.push(`Partido ${pred.matchId}: ${String(e)}`) }
      }
    }

    if (Array.isArray(groupPreds) && groupPreds.length > 0) {
      const groupMap = new Map<string, { firstPlace?: string; secondPlace?: string; thirdPlace?: string }>()
      for (const { key, team } of groupPreds) {
        const m = key.match(/^(GROUP_[A-L])_(FIRST|SECOND|THIRD)$/)
        if (!m) continue
        const entry = groupMap.get(m[1]) ?? {}
        if (m[2] === 'FIRST') entry.firstPlace = team
        else if (m[2] === 'SECOND') entry.secondPlace = team
        else if (m[2] === 'THIRD') entry.thirdPlace = team
        groupMap.set(m[1], entry)
      }
      const allGroupMatches = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
      const firstByGroup = new Map<string, typeof allGroupMatches[0]>()
      for (const m of allGroupMatches) {
        if (!m.groupName) continue
        const cur = firstByGroup.get(m.groupName)
        if (!cur || m.matchDatetime < cur.matchDatetime) firstByGroup.set(m.groupName, m)
      }
      for (const [groupName, entry] of groupMap) {
        if (!entry.firstPlace || !entry.secondPlace) { skipped++; continue }
        const first = firstByGroup.get(groupName)
        if (first?.lockTime && new Date() >= new Date(first.lockTime)) { skipped++; continue }
        try {
          await db.insert(groupPredictions).values({ userId, pollaId, groupName, firstPlace: entry.firstPlace, secondPlace: entry.secondPlace, thirdPlace: entry.thirdPlace ?? null })
            .onConflictDoUpdate({
              target: [groupPredictions.userId, groupPredictions.groupName, groupPredictions.pollaId],
              set: { firstPlace: entry.firstPlace, secondPlace: entry.secondPlace, thirdPlace: entry.thirdPlace ?? null },
            })
          imported++
        } catch (e) { errors.push(`Grupo ${groupName}: ${String(e)}`) }
      }
    }

    const allSpecials = [
      ...(Array.isArray(specialPreds) ? specialPreds : []),
      ...(Array.isArray(bonusPredictions) ? bonusPredictions : []),
    ]
    if (allSpecials.length > 0) {
      const gms = await db.select().from(matches).where(eq(matches.stage, 'GROUP_STAGE'))
      let bonusLocked = false
      if (gms.length > 0) {
        const earliest = gms.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
        bonusLocked = !!(earliest.lockTime && new Date() >= new Date(earliest.lockTime))
      }
      if (bonusLocked) {
        skipped += allSpecials.length
      } else {
        for (const pred of allSpecials) {
          const isTeam = TEAM_SPECIAL_TYPES.has(pred.type)
          try {
            await db.insert(specialPredictions).values({ userId, pollaId, type: pred.type, teamName: isTeam ? pred.value : null, playerName: isTeam ? null : pred.value })
              .onConflictDoUpdate({
                target: [specialPredictions.userId, specialPredictions.type, specialPredictions.pollaId],
                set: { teamName: isTeam ? pred.value : null, playerName: isTeam ? null : pred.value },
              })
            imported++
          } catch (e) { errors.push(`Especial ${pred.type}: ${String(e)}`) }
        }
      }
    }

    if (Array.isArray(questionAnswers) && questionAnswers.length > 0) {
      const qIds = questionAnswers.map(a => a.questionId)
      const [dbQuestions, dbOptions] = await Promise.all([
        db.select().from(pollaQuestions).where(and(eq(pollaQuestions.pollaId, pollaId), inArray(pollaQuestions.id, qIds))),
        db.select().from(pollaQuestionOptions).where(inArray(pollaQuestionOptions.questionId, qIds)),
      ])
      const questionById = new Map(dbQuestions.map(q => [q.id, q]))
      const optionsByQuestion = dbOptions.reduce<Record<string, typeof dbOptions>>((acc, o) => {
        ;(acc[o.questionId] ??= []).push(o)
        return acc
      }, {})
      for (const qa of questionAnswers) {
        const question = questionById.get(qa.questionId)
        if (!question || !question.enabled) { skipped++; continue }
        let optionId: string | null = null
        if (question.type === 'range') {
          const opts = optionsByQuestion[qa.questionId] ?? []
          const matched = opts.find(o => o.label.toLowerCase().trim() === qa.answer.toLowerCase().trim())
          if (!matched) { skipped++; continue }
          optionId = matched.id
        }
        try {
          await db.insert(pollaAnswers).values({ userId, pollaId, questionId: qa.questionId, answer: qa.answer, optionId })
            .onConflictDoUpdate({
              target: [pollaAnswers.userId, pollaAnswers.questionId, pollaAnswers.pollaId],
              set: { answer: qa.answer, optionId },
            })
          imported++
        } catch (e) { errors.push(`Pregunta ${qa.questionId}: ${String(e)}`) }
      }
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
