import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaMembers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const existing = await db.select({ id: pollaMembers.id, inscriptionStatus: pollaMembers.inscriptionStatus })
    .from(pollaMembers)
    .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, session.userId)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Ya eres miembro de esta polla', inscriptionStatus: existing[0].inscriptionStatus }, { status: 409 })
  }

  await db.insert(pollaMembers).values({
    pollaId,
    userId: session.userId,
    role: 'participant',
    inscriptionStatus: 'pending',
  })

  return NextResponse.json({ ok: true, inscriptionStatus: 'pending' }, { status: 201 })
}
