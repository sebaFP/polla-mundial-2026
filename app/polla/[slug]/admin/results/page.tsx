import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Gestión de Resultados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sync automático vía football-data.org o ingresa manualmente
        </p>
      </div>
      <ResultsManager initialMatches={allMatches} pollaId={polla.id} />
    </div>
  )
}
