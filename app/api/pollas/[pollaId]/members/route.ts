import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaMembers, users, invitations } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById } from '@/lib/polla'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAvatarColor } from '@/lib/teams'
import { randomUUID } from 'crypto'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const role = await getMemberRole(pollaId, session.userId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await db.select({
    id: pollaMembers.id,
    userId: pollaMembers.userId,
    pollaId: pollaMembers.pollaId,
    role: pollaMembers.role,
    inscriptionStatus: pollaMembers.inscriptionStatus,
    inscriptionNotes: pollaMembers.inscriptionNotes,
    joinedAt: pollaMembers.joinedAt,
    name: users.name,
    email: users.email,
    avatarColor: users.avatarColor,
  })
    .from(pollaMembers)
    .innerJoin(users, eq(pollaMembers.userId, users.id))
    .where(eq(pollaMembers.pollaId, pollaId))

  // Attach QR tokens (only admins can see these)
  if (role === 'admin') {
    const invs = await db.select({ userId: invitations.userId, token: invitations.token })
      .from(invitations)
      .where(eq(invitations.pollaId, pollaId))
    const tokenMap = Object.fromEntries(invs.map(i => [i.userId, i.token]))
    return NextResponse.json(members.map(m => ({ ...m, qrToken: tokenMap[m.userId] ?? null })))
  }

  return NextResponse.json(members)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const role = await getMemberRole(pollaId, session.userId)
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const qrToken = randomUUID()
  const internalEmail = `p-${qrToken}@polla.internal`

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password: qrToken,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (authError || !authData.user) {
    console.error(authError)
    return NextResponse.json({ error: 'Error creando usuario' }, { status: 500 })
  }

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users)
  const idx = Number(count)

  let created, invitation
  try {
    ;[created] = await db.insert(users).values({
      id: authData.user.id,
      name: name.trim(),
      email: email?.trim() || null,
      avatarColor: getAvatarColor(idx),
      isSuperAdmin: false,
    }).returning()

    ;[invitation] = await db.insert(invitations).values({
      userId: created.id,
      pollaId,
      token: qrToken,
    }).returning()

    await db.insert(pollaMembers).values({
      pollaId,
      userId: created.id,
      role: 'participant',
      inscriptionStatus: 'pending',
    })
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error('DB insert failed, auth user rolled back:', err)
    return NextResponse.json({ error: 'Error creando usuario' }, { status: 500 })
  }

  return NextResponse.json({ ...created, qrToken: invitation.token, role: 'participant' }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const adminRole = await getMemberRole(pollaId, session.userId)
  if (adminRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role, inscriptionStatus } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const updates: Partial<{ role: string; inscriptionStatus: string }> = {}
  if (role) updates.role = role
  if (inscriptionStatus) updates.inscriptionStatus = inscriptionStatus

  const [updated] = await db.update(pollaMembers)
    .set(updates)
    .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, userId)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const adminRole = await getMemberRole(pollaId, session.userId)
  if (adminRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  await db.delete(pollaMembers)
    .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, userId)))

  return NextResponse.json({ ok: true })
}
