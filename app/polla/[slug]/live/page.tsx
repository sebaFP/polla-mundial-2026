import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole, getPollaConfig } from '@/lib/polla'
import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import LiveView from '@/components/live/LiveView'

export const revalidate = 0

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const config = await getPollaConfig(polla.id)

  if (!session) {
    // Layout already blocks private pollas — but double-check here too
    if (config.polla_visibility !== 'public') redirect('/login')

    const allMatches = await db.select().from(matches)
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
          initialPredictions={[]}
          initialLeaderboard={[]}
          userId={null}
          pollaId={polla.id}
        />
      </div>
    )
  }

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
