import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
    app_metadata: { role: 'admin' },
  })

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      return NextResponse.json({ error: 'Email ya está en uso' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error creando administrador' }, { status: 500 })
  }

  let created
  try {
    ;[created] = await db.insert(users).values({
      id: authData.user.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'admin',
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error('DB insert failed, auth user rolled back:', err)
    return NextResponse.json({ error: 'Error creando administrador' }, { status: 500 })
  }

  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  if (userId === session.userId) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  const target = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'admin')))
    .limit(1)
  if (target.length === 0) return NextResponse.json({ error: 'Administrador no encontrado' }, { status: 404 })

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) return NextResponse.json({ error: 'Error eliminando usuario' }, { status: 500 })

  await db.delete(users).where(and(eq(users.id, userId), eq(users.role, 'admin')))
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, password } = await req.json()
  if (!userId || !password) return NextResponse.json({ error: 'userId y password requeridos' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
