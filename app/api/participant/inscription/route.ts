import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (user.inscriptionStatus !== 'pending') {
    return NextResponse.json({ error: 'Estado no modificable' }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set({ inscriptionStatus: 'confirmed' })
    .where(eq(users.id, session.userId))
    .returning()

  return NextResponse.json(updated)
}
