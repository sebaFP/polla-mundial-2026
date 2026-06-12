import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invitations, users } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { pollas } from '@/lib/db/schema'
import JoinClient from './JoinClient'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [found] = await db.select({
    userId: invitations.userId,
    pollaId: invitations.pollaId,
  }).from(invitations).where(
    and(
      eq(invitations.token, token),
      or(isNull(invitations.expiresAt), gt(invitations.expiresAt, new Date())),
    )
  ).limit(1)

  if (!found) {
    redirect('/login?error=invalid-token')
  }

  // Look up the invited user's name
  const [invitedUser] = await db.select({ name: users.name })
    .from(users).where(eq(users.id, found.userId)).limit(1)

  const invitedName = invitedUser?.name ?? 'participante'

  const session = await getSession()

  // Same user already logged in — fast path: mark used and redirect
  if (session && session.userId === found.userId) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signInWithPassword({
      email: `p-${token}@polla.internal`,
      password: token,
    })
    await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.token, token))

    if (found.pollaId) {
      const [polla] = await db.select({ slug: pollas.slug }).from(pollas).where(eq(pollas.id, found.pollaId)).limit(1)
      if (polla) redirect(`/polla/${polla.slug}/predictions`)
    }
    redirect('/')
  }

  // Different user logged in → show reassignment screen
  if (session) {
    return (
      <JoinClient
        token={token}
        invitedName={invitedName}
        mode="reassign"
        currentUserName={session.name}
      />
    )
  }

  // No session → show "enter as [name]" screen
  return (
    <JoinClient
      token={token}
      invitedName={invitedName}
      mode="auto-login"
    />
  )
}
