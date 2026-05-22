import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// QR login: token is both the invitation lookup key and the Supabase Auth password
// Participant's internal email: p-{token}@polla.internal
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    const found = await db.select().from(invitations).where(
      and(eq(invitations.token, token), or(isNull(invitations.expiresAt), gt(invitations.expiresAt, new Date())))
    ).limit(1)
    if (found.length === 0) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `p-${token}@polla.internal`,
      password: token,
    })

    if (error || !data.user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Mark invitation as used (non-blocking)
    await db.update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.token, token))

    return NextResponse.json({
      ok: true,
      role: data.user.app_metadata?.role ?? 'participant',
      name: data.user.user_metadata?.name ?? '',
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
