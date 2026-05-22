import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, predictions, groupPredictions, specialPredictions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getAvatarColor } from '@/lib/teams'
import { randomUUID } from 'crypto'

export async function GET() {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allUsers = await db.select().from(users).where(eq(users.role, 'participant'))

  const pts = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`COALESCE(SUM(${predictions.points}), 0)`,
    })
    .from(predictions)
    .groupBy(predictions.userId)

  const ptsMap = Object.fromEntries(pts.map(r => [r.userId, Number(r.total)]))

  const result = allUsers.map(u => ({
    ...u,
    totalPoints: ptsMap[u.id] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const count = await db.select({ c: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, 'participant'))
  const idx = Number(count[0].c)

  const created = await db.insert(users).values({
    name: name.trim(),
    email: email?.trim() || null,
    role: 'participant',
    qrToken: randomUUID(),
    avatarColor: getAvatarColor(idx),
  }).returning()

  return NextResponse.json(created[0], { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  await db.delete(users).where(eq(users.id, userId))
  return NextResponse.json({ ok: true })
}
