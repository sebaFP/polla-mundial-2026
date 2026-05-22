import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import ParticipantNav from '@/components/ParticipantNav'

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen gradient-bg">
      <ParticipantNav userName={session.name} role={session.role} />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
