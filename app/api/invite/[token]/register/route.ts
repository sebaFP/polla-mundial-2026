import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaInviteLinks, users, invitations, pollaMembers, pollas } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAvatarColor } from '@/lib/teams'
import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = await params

  const [link] = await db.select({
    id: pollaInviteLinks.id,
    pollaId: pollaInviteLinks.pollaId,
  }).from(pollaInviteLinks).where(
    and(
      eq(pollaInviteLinks.token, token),
      or(isNull(pollaInviteLinks.expiresAt), gt(pollaInviteLinks.expiresAt, new Date()))
    )
  ).limit(1)

  if (!link) return NextResponse.json({ error: 'Enlace inválido o expirado' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const [polla] = await db.select({ slug: pollas.slug }).from(pollas).where(eq(pollas.id, link.pollaId)).limit(1)

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

  try {
    const [created] = await db.insert(users).values({
      id: authData.user.id,
      name: name.trim(),
      avatarColor: getAvatarColor(idx),
      isSuperAdmin: false,
    }).returning()

    await db.insert(invitations).values({
      userId: created.id,
      pollaId: link.pollaId,
      token: qrToken,
    })

    await db.insert(pollaMembers).values({
      pollaId: link.pollaId,
      userId: created.id,
      role: 'participant',
      inscriptionStatus: 'pending',
    })
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error('DB insert failed, auth user rolled back:', err)
    return NextResponse.json({ error: 'Error creando usuario' }, { status: 500 })
  }

  // Sign them in so cookies are set
  const supabase = await createSupabaseServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password: qrToken,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Cuenta creada pero no se pudo iniciar sesión automáticamente' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: polla?.slug ?? null }, { status: 201 })
}
