import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 })
  }

  const found = await db.select({ passwordHash: users.passwordHash })
    .from(users).where(eq(users.id, session.userId)).limit(1)

  if (found.length === 0) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Only allow if password not yet set
  if (found[0].passwordHash) {
    return NextResponse.json({ error: 'Usa cambiar contraseña para actualizar' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.userId))

  return NextResponse.json({ ok: true })
}
