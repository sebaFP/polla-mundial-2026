import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Contraseña actual y nueva requeridas' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Nueva contraseña mínimo 8 caracteres' }, { status: 400 })
  }

  const found = await db.select({ passwordHash: users.passwordHash })
    .from(users).where(eq(users.id, session.userId)).limit(1)

  if (found.length === 0) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const hash = found[0].passwordHash
  if (!hash) return NextResponse.json({ error: 'No tienes contraseña configurada aún' }, { status: 400 })

  const valid = await bcrypt.compare(currentPassword, hash)
  if (!valid) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })

  const newHash = await bcrypt.hash(newPassword, 12)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.userId))

  return NextResponse.json({ ok: true })
}
