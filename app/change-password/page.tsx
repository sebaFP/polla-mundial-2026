import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return <ChangePasswordForm email={session.email ?? ''} />
}
