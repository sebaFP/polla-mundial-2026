import { db } from '@/lib/db'
import { matches, pollaResultOverrides } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug } from '@/lib/polla'
import { redirect } from 'next/navigation'
import ResultsManager from '@/components/admin/ResultsManager'

export const revalidate = 0

export default async function PollaResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const allMatches = await db.select().from(matches).orderBy(matches.matchDatetime)

  const overrides = await db.select().from(pollaResultOverrides)
    .where(eq(pollaResultOverrides.pollaId, polla.id))

  const overrideMap = new Map(overrides.map(o => [o.matchId, { score1: o.score1, score2: o.score2 }]))

  const matchesWithOverrides = allMatches.map(m => ({
    ...m,
    override: overrideMap.get(m.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Gestión de Resultados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sync automático vía football-data.org o ingresa manualmente
        </p>
      </div>
      <ResultsManager initialMatches={matchesWithOverrides} pollaId={polla.id} />
    </div>
  )
}
