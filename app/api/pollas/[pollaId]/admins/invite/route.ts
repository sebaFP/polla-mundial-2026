import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  // Find user by email
  const [targetUser] = await db.select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)

  if (!targetUser) {
    return NextResponse.json({ error: 'Usuario no encontrado. Debe registrarse primero.' }, { status: 404 })
  }

  // Check if already a member
  const [existing] = await db.select().from(pollaMembers)
    .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, targetUser.id)))
    .limit(1)

  if (existing) {
    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'Ya es admin de esta polla' }, { status: 409 })
    }
    // Promote existing participant to admin
    const [updated] = await db.update(pollaMembers)
      .set({ role: 'admin' })
      .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, targetUser.id)))
      .returning()
    return NextResponse.json({ ...targetUser, userId: targetUser.id, role: 'admin', inscriptionStatus: updated.inscriptionStatus })
  }

  // Add as new admin member
  await db.insert(pollaMembers).values({
    pollaId,
    userId: targetUser.id,
    role: 'admin',
    inscriptionStatus: 'approved',
  })

  return NextResponse.json({ ...targetUser, userId: targetUser.id, role: 'admin', inscriptionStatus: 'approved' }, { status: 201 })
}
