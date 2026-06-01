import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { passwordResetRequests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { supabaseAdmin } from '@/lib/supabase/admin'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 10; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession()
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId } = await params

  const [request] = await db
    .select()
    .from(passwordResetRequests)
    .where(eq(passwordResetRequests.id, requestId))
    .limit(1)

  if (!request) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  if (!request.userId) {
    return NextResponse.json({ error: 'No hay usuario asociado a este email' }, { status: 400 })
  }

  const tempPassword = generateTempPassword()

  const { error } = await supabaseAdmin.auth.admin.updateUserById(request.userId, {
    password: tempPassword,
    app_metadata: { mustChangePassword: true },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await db
    .update(passwordResetRequests)
    .set({ status: 'resolved', resolvedAt: new Date(), resolvedById: session.userId })
    .where(eq(passwordResetRequests.id, requestId))

  return NextResponse.json({ tempPassword })
}
