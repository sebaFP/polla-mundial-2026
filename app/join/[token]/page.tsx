import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createToken, setSessionCookie } from '@/lib/auth/session'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const found = await db.select().from(users).where(eq(users.qrToken, token)).limit(1)

  if (found.length === 0) {
    redirect('/login?error=invalid-token')
  }

  const user = found[0]
  const jwt = await createToken({
    userId: user.id,
    role: user.role as 'admin' | 'participant',
    name: user.name,
  })

  await setSessionCookie(jwt)

  // First QR login: no password set yet → prompt to create one
  if (!user.passwordHash) {
    redirect('/set-password')
  }

  redirect('/predictions')
}
