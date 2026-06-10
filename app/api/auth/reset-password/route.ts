import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { passwordResetTokens } from '@/lib/db/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()
    if (!token || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'Token y contraseña (mínimo 8 caracteres) requeridos' },
        { status: 400 }
      )
    }

    const now = new Date()

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1)

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Link inválido o expirado. Solicita uno nuevo.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(resetToken.userId, {
      password,
      app_metadata: { mustChangePassword: false },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
