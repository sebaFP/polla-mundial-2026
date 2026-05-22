import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

    const role = data.user.app_metadata?.role ?? 'participant'
    if (role !== 'admin') {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'Acceso solo para administradores' }, { status: 403 })
    }

    const redirect = '/admin'
    return NextResponse.json({ ok: true, role, name: data.user.user_metadata?.name ?? '', redirect })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
