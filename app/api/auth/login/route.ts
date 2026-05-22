import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createToken, setSessionCookie } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const found = await db.select().from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1)

    if (found.length === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const user = found[0]

    if (user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    } else if (user.role === 'admin') {
      // Bootstrap fallback: env-var password for first admin login
      if (email.trim().toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase() || password !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
      }
    } else {
      // Participant without password set — must use QR
      return NextResponse.json({ error: 'Debes iniciar sesión con tu código QR' }, { status: 401 })
    }

    const token = await createToken({
      userId: user.id,
      role: user.role as 'admin' | 'participant',
      name: user.name,
    })

    await setSessionCookie(token)

    const redirect = user.role === 'admin' ? '/admin' : '/predictions'
    return NextResponse.json({ ok: true, role: user.role, name: user.name, redirect })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
