import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const found = await db.select().from(invitations).where(
    and(eq(invitations.token, token), or(isNull(invitations.expiresAt), gt(invitations.expiresAt, new Date())))
  ).limit(1)

  if (found.length === 0) {
    redirect('/login?error=invalid-token')
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `p-${token}@polla.internal`,
    password: token,
  })

  if (error || !data.user) {
    redirect('/login?error=invalid-token')
  }

  // Mark as used
  await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.token, token))

  redirect('/predictions')
}
