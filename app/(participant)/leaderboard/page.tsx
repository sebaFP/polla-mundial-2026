import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import LeaderboardView from '@/components/leaderboard/LeaderboardView'

export const revalidate = 30

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Tabla de Posiciones</h1>
        <p className="text-muted-foreground text-sm mt-1">Actualizada en tiempo real</p>
      </div>
      <LeaderboardView currentUserId={session.userId} />
    </div>
  )
}
