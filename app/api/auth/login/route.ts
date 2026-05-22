import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createToken, setSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    // Find or create admin user
    let adminUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (adminUser.length === 0) {
      const created = await db.insert(users).values({
        name: 'Administrador',
        email,
        role: 'admin',
      }).returning()
      adminUser = created
    }

    const token = await createToken({
      userId: adminUser[0].id,
      role: 'admin',
      name: adminUser[0].name,
    })

    await setSessionCookie(token)
    return NextResponse.json({ ok: true, role: 'admin' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
