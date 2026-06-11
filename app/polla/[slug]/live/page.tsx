import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import LiveView from '@/components/live/LiveView'

export const revalidate = 0

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const myRole = await getMemberRole(polla.id, session.userId)
  if (!myRole) redirect('/')

  const [allMatches, myPredictions] = await Promise.all([
    db.select().from(matches),
    db.select().from(predictions).where(
      and(eq(predictions.userId, session.userId), eq(predictions.pollaId, polla.id))
    ),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">En Vivo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resultados en tiempo real · actualiza automáticamente
        </p>
      </div>

      <LiveView
        initialMatches={allMatches}
        initialPredictions={myPredictions}
        initialLeaderboard={[]}
        userId={session.userId}
        pollaId={polla.id}
      />
    </div>
  )
}
