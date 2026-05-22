import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createToken, setSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    const found = await db.select().from(users).where(eq(users.qrToken, token)).limit(1)
    if (found.length === 0) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const user = found[0]
    const jwt = await createToken({
      userId: user.id,
      role: user.role as 'admin' | 'participant',
      name: user.name,
    })

    await setSessionCookie(jwt)
    return NextResponse.json({ ok: true, role: user.role, name: user.name })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
