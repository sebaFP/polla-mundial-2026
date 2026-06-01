import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { passwordResetRequests, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await db
    .select({
      id: passwordResetRequests.id,
      email: passwordResetRequests.email,
      message: passwordResetRequests.message,
      status: passwordResetRequests.status,
      createdAt: passwordResetRequests.createdAt,
      resolvedAt: passwordResetRequests.resolvedAt,
      userId: passwordResetRequests.userId,
      userName: users.name,
    })
    .from(passwordResetRequests)
    .leftJoin(users, eq(passwordResetRequests.userId, users.id))
    .orderBy(desc(passwordResetRequests.createdAt))

  return NextResponse.json(requests)
}
