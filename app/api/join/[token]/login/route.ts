import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invitations, pollas } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [found] = await db.select({
    pollaId: invitations.pollaId,
  }).from(invitations).where(
    and(
      eq(invitations.token, token),
      or(isNull(invitations.expiresAt), gt(invitations.expiresAt, new Date())),
    )
  ).limit(1)

  if (!found) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 })
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `p-${token}@polla.internal`,
    password: token,
  })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 401 })
  }

  await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.token, token))

  let slug: string | null = null
  if (found.pollaId) {
    const [polla] = await db.select({ slug: pollas.slug }).from(pollas).where(eq(pollas.id, found.pollaId)).limit(1)
    if (polla) slug = polla.slug
  }

  return NextResponse.json({ ok: true, slug })
}
