import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error || !data.user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const [dbUser] = await db.select({ isSuperAdmin: users.isSuperAdmin })
      .from(users).where(eq(users.id, data.user.id))

    const name = data.user.user_metadata?.name ?? ''
    return NextResponse.json({
      ok: true,
      name,
      isSuperAdmin: dbUser?.isSuperAdmin ?? false,
      redirect: '/',
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
