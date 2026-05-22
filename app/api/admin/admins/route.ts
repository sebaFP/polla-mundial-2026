import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admins = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.role, 'admin'))

  return NextResponse.json(admins)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password } = await req.json()
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña requeridos' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 })
  }

  // Check email not taken
  const existing = await db.select().from(users).where(eq(users.email, email.trim())).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email ya está en uso' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const created = await db.insert(users).values({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'admin',
    passwordHash,
  }).returning({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
  })

  return NextResponse.json(created[0], { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  if (userId === session.userId) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  await db.delete(users).where(and(eq(users.id, userId), eq(users.role, 'admin')))
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, password } = await req.json()
  if (!userId || !password) return NextResponse.json({ error: 'userId y password requeridos' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 12)
  await db.update(users).set({ passwordHash }).where(and(eq(users.id, userId), eq(users.role, 'admin')))
  return NextResponse.json({ ok: true })
}
