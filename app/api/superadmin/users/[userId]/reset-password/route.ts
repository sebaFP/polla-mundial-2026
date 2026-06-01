import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendTempPassword } from '@/lib/email'

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
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession()
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const tempPassword = generateTempPassword()

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    app_metadata: { mustChangePassword: true },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (user?.email && !user.email.includes('@polla.internal')) {
    sendTempPassword({
      toEmail: user.email,
      toName: user.name,
      tempPassword,
    }).catch(console.error)
  }

  return NextResponse.json({ tempPassword })
}
