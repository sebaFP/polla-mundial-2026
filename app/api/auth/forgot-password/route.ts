import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, passwordResetTokens } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendPasswordResetLink } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    // Always respond OK — don't reveal whether email exists
    if (!user || !user.email || user.email.includes('@polla.internal')) {
      return NextResponse.json({ ok: true })
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    const [{ token }] = await db
      .insert(passwordResetTokens)
      .values({ userId: user.id, expiresAt })
      .returning({ token: passwordResetTokens.token })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const resetLink = `${appUrl}/reset-password?token=${token}`

    sendPasswordResetLink({
      toEmail: user.email,
      toName: user.name,
      resetLink,
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
