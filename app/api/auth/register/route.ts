import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getAvatarColor } from '@/lib/teams'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña requeridos' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Contraseña mínimo 6 caracteres' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    })

    if (authError || !authData.user) {
      const msg = authError?.message ?? ''
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })
      }
      console.error(authError)
      return NextResponse.json({ error: 'Error creando cuenta' }, { status: 500 })
    }

    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users)

    try {
      await db.insert(users).values({
        id: authData.user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarColor: getAvatarColor(Number(count)),
        isSuperAdmin: false,
      })
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.error('DB insert failed, auth user rolled back:', err)
      return NextResponse.json({ error: 'Error creando cuenta' }, { status: 500 })
    }

    // Sign in the new user to establish session
    const supabase = await createSupabaseServerClient()
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError || !signInData.user) {
      return NextResponse.json({ error: 'Cuenta creada, inicia sesión manualmente' }, { status: 201 })
    }

    return NextResponse.json({ ok: true, name: name.trim(), redirect: '/' }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
