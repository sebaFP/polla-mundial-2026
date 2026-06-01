import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, passwordResetRequests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendResetRequestNotification } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email, message } = await req.json()
    if (!email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Email y mensaje requeridos' }, { status: 400 })
    }
    if (message.trim().length < 10) {
      return NextResponse.json({ error: 'Mensaje muy corto (mínimo 10 caracteres)' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    await db.insert(passwordResetRequests).values({
      userId: user?.id ?? null,
      email: normalizedEmail,
      message: message.trim(),
      status: 'pending',
    })

    // Notify all super admins by email (fire-and-forget)
    const superAdmins = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.isSuperAdmin, true))

    const adminEmails = superAdmins.map(a => a.email).filter(Boolean) as string[]

    sendResetRequestNotification({
      adminEmails,
      requesterEmail: normalizedEmail,
      requesterName: user?.name ?? null,
      message: message.trim(),
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
