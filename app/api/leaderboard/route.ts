import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, predictions, groupPredictions, specialPredictions } from '@/lib/db/schema'
import { eq, sql, or, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export type LeaderboardEntry = {
  userId: string
  name: string
  avatarColor: string | null
  matchPoints: number
  groupPoints: number
  specialPoints: number
  totalPoints: number
  rank: number
  predictedMatches: number
  scoredMatches: number
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Aggregate match prediction points
  const matchPts = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
      predicted: sql<number>`COUNT(${predictions.id})`,
      scored: sql<number>`COUNT(CASE WHEN ${predictions.points} IS NOT NULL THEN 1 END)`,
    })
    .from(predictions)
    .groupBy(predictions.userId)

  // Aggregate group prediction points
  const groupPts = await db
    .select({
      userId: groupPredictions.userId,
      total: sql<number>`COALESCE(SUM(COALESCE(${groupPredictions.pointsFirst}, 0) + COALESCE(${groupPredictions.pointsSecond}, 0)), 0)`,
    })
    .from(groupPredictions)
    .groupBy(groupPredictions.userId)

  // Aggregate special prediction points
  const specialPts = await db
    .select({
      userId: specialPredictions.userId,
      total: sql<number>`COALESCE(SUM(${specialPredictions.points}), 0)`,
    })
    .from(specialPredictions)
    .groupBy(specialPredictions.userId)

  // Participants + admins approved as participants
  const allUsers = await db.select().from(users).where(
    or(
      eq(users.role, 'participant'),
      and(eq(users.role, 'admin'), eq(users.inscriptionStatus, 'approved'))
    )
  )

  const matchMap = Object.fromEntries(matchPts.map(r => [r.userId, r]))
  const groupMap = Object.fromEntries(groupPts.map(r => [r.userId, r]))
  const specialMap = Object.fromEntries(specialPts.map(r => [r.userId, r]))

  const entries: LeaderboardEntry[] = allUsers.map(u => {
    const m = matchMap[u.id]
    const g = groupMap[u.id]
    const s = specialMap[u.id]
    const matchPoints = Number(m?.total ?? 0)
    const groupPoints = Number(g?.total ?? 0)
    const specialPoints = Number(s?.total ?? 0)
    return {
      userId: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
      matchPoints,
      groupPoints,
      specialPoints,
      totalPoints: matchPoints + groupPoints + specialPoints,
      rank: 0,
      predictedMatches: Number(m?.predicted ?? 0),
      scoredMatches: Number(m?.scored ?? 0),
    }
  })

  entries.sort((a, b) => b.totalPoints - a.totalPoints)
  entries.forEach((e, i) => { e.rank = i + 1 })

  return NextResponse.json(entries)
}
