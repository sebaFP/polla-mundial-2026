import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const forcedChange = user?.app_metadata?.mustChangePassword === true

  return <ChangePasswordForm email={session.email ?? ''} forcedChange={forcedChange} />
}
