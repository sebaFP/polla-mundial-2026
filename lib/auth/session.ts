import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SessionPayload = {
  userId: string
  role: 'admin' | 'participant'
  name: string
}

export async function getSession(): Promise<SessionPayload | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  return {
    userId: user.id,
    role: (user.app_metadata?.role ?? 'participant') as 'admin' | 'participant',
    name: (user.user_metadata?.name ?? '') as string,
  }
}
