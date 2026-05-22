import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, invitations, predictions } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
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

  // Attach QR tokens from invitations
  const invs = await db.select({ userId: invitations.userId, token: invitations.token })
    .from(invitations)

  const tokenMap = Object.fromEntries(invs.map(i => [i.userId, i.token]))

  const result = allUsers.map(u => ({
    ...u,
    totalPoints: ptsMap[u.id] ?? 0,
    qrToken: tokenMap[u.id] ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const qrToken = randomUUID()
  const internalEmail = `p-${qrToken}@polla.internal`

  // Create Supabase Auth user with QR token as password
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password: qrToken,
    email_confirm: true,
    user_metadata: { name: name.trim() },
    app_metadata: { role: 'participant' },
  })

  if (authError || !authData.user) {
    console.error(authError)
    return NextResponse.json({ error: 'Error creando usuario' }, { status: 500 })
  }

  const count = await db.select({ c: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, 'participant'))
  const idx = Number(count[0].c)

  let created, invitation
  try {
    ;[created] = await db.insert(users).values({
      id: authData.user.id,
      name: name.trim(),
      email: email?.trim() || null,
      role: 'participant',
      avatarColor: getAvatarColor(idx),
    }).returning()

    ;[invitation] = await db.insert(invitations).values({
      userId: created.id,
      token: qrToken,
    }).returning()
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error('DB insert failed, auth user rolled back:', err)
    return NextResponse.json({ error: 'Error creando usuario' }, { status: 500 })
  }

  return NextResponse.json({ ...created, qrToken: invitation.token }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, inscriptionStatus } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const [updated] = await db.update(users)
    .set({ inscriptionStatus })
    .where(and(eq(users.id, userId), eq(users.role, 'admin')))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Admin no encontrado' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) return NextResponse.json({ error: 'Error eliminando usuario' }, { status: 500 })

  await db.delete(users).where(eq(users.id, userId))
  return NextResponse.json({ ok: true })
}
