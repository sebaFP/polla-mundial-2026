import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { currentPassword, newPassword } = await req.json()
    if (!newPassword) {
      return NextResponse.json({ error: 'Nueva contraseña requerida' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Nueva contraseña mínimo 8 caracteres' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const isForcedChange = user.app_metadata?.mustChangePassword === true

    // If not a forced change, verify current password
    if (!isForcedChange) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Contraseña actual requerida' }, { status: 400 })
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (isForcedChange) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { mustChangePassword: false },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
