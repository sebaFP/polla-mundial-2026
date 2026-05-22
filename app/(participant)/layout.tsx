import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Legacy layout — redirects to new polla-scoped routes
  redirect('/')
}
