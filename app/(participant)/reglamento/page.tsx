import { db } from '@/lib/db'
import { tournamentConfig } from '@/lib/db/schema'
import { DEFAULT_CONFIG } from '@/lib/scoring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const revalidate = 60

export default async function ReglamentoPage() {
  const rows = await db.select().from(tournamentConfig)
  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }
  const rulesText = config.rules_text ?? ''

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Reglamento</h1>
        <p className="text-muted-foreground text-sm mt-1">Reglas y condiciones del torneo</p>
      </div>

      {rulesText ? (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{rulesText}</pre>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card p-8 text-center text-muted-foreground">
          <p className="text-3xl mb-3">📋</p>
          <p>El reglamento aún no ha sido publicado.</p>
        </Card>
      )}
    </div>
  )
}
