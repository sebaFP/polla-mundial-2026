import { createSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type SessionPayload = {
  userId: string
  name: string
  email: string
  isSuperAdmin: boolean
}

export async function getSession(): Promise<SessionPayload | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const [dbUser] = await db.select({ isSuperAdmin: users.isSuperAdmin })
    .from(users).where(eq(users.id, user.id))

  return {
    userId: user.id,
    name: (user.user_metadata?.name ?? '') as string,
    email: user.email ?? '',
    isSuperAdmin: dbUser?.isSuperAdmin ?? false,
  }
}
