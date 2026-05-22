import { db } from '@/lib/db'
import { tournamentConfig } from '@/lib/db/schema'
import { DEFAULT_CONFIG } from '@/lib/scoring'
import ConfigPanel from '@/components/admin/ConfigPanel'

export const revalidate = 0

export default async function ConfigPage() {
  const rows = await db.select().from(tournamentConfig)
  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Configuración de Reglas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define los puntos para cada tipo de pronóstico y activa/desactiva funcionalidades
        </p>
      </div>
      <ConfigPanel initialConfig={config} />
    </div>
  )
}
