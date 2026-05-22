import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import ParticipantNav from '@/components/ParticipantNav'

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="relative min-h-screen gradient-bg overflow-x-hidden">
      {/* Geometric pattern overlay — inspired by FIFA 2026 "26" motif */}
      <div className="pattern-geo absolute inset-0" aria-hidden />

      <div className="relative z-10">
        <ParticipantNav userName={session.name} role={session.role} />
        <main className="container mx-auto px-4 py-6 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  )
}
