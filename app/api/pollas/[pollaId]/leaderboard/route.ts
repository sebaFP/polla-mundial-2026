import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, predictions, groupPredictions, specialPredictions, pollaMembers } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

export type LeaderboardEntry = {
  userId: string
  name: string
  avatarColor: string | null
  role: string
  matchPoints: number
  groupPoints: number
  specialPoints: number
  totalPoints: number
  rank: number
  predictedMatches: number
  scoredMatches: number
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

  // Get all polla members with user info
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
      // Include admins who opted into participating (approved inscription)
      sql`(${pollaMembers.role} = 'participant' OR (${pollaMembers.role} = 'admin' AND ${pollaMembers.inscriptionStatus} = 'approved'))`
    ))

  const matchMap = Object.fromEntries(matchPts.map(r => [r.userId, r]))
  const groupMap = Object.fromEntries(groupPts.map(r => [r.userId, r]))
  const specialMap = Object.fromEntries(specialPts.map(r => [r.userId, r]))

  const entries: LeaderboardEntry[] = members.map(m => {
    const mp = matchMap[m.userId]
    const gp = groupMap[m.userId]
    const sp = specialMap[m.userId]
    const matchPoints = Number(mp?.total ?? 0)
    const groupPoints = Number(gp?.total ?? 0)
    const specialPoints = Number(sp?.total ?? 0)
    return {
      userId: m.userId,
      name: m.name,
      avatarColor: m.avatarColor,
      role: m.role,
      matchPoints,
      groupPoints,
      specialPoints,
      totalPoints: matchPoints + groupPoints + specialPoints,
      rank: 0,
      predictedMatches: Number(mp?.predicted ?? 0),
      scoredMatches: Number(mp?.scored ?? 0),
    }
  })

  entries.sort((a, b) => b.totalPoints - a.totalPoints)
  entries.forEach((e, i) => { e.rank = i + 1 })

  return NextResponse.json(entries)
}
