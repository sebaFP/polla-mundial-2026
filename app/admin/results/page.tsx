import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
import { ne } from 'drizzle-orm'
import ResultsManager from '@/components/admin/ResultsManager'

export const revalidate = 0

export default async function ResultsPage() {
  const allMatches = await db.select().from(matches)
    .orderBy(matches.matchDatetime)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Gestión de Resultados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sync automático vía football-data.org o ingresa manualmente
        </p>
      </div>
      <ResultsManager initialMatches={allMatches} />
    </div>
  )
}
