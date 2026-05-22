import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const { status, notes } = await req.json()

  const validStatuses = ['pending', 'confirmed', 'approved', 'rejected']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const updated = await db
    .update(users)
    .set({
      inscriptionStatus: status,
      ...(notes !== undefined ? { inscriptionNotes: notes || null } : {}),
    })
    .where(eq(users.id, userId))
    .returning()

  if (!updated.length) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json(updated[0])
}
