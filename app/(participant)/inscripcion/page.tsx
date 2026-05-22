import { db } from '@/lib/db'
import { users, tournamentConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { DEFAULT_CONFIG } from '@/lib/scoring'
import InscripcionClient from './InscripcionClient'

export const revalidate = 0

export default async function InscripcionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [configRows, userRows] = await Promise.all([
    db.select().from(tournamentConfig),
    db.select().from(users).where(eq(users.id, session.userId)).limit(1),
  ])

  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(configRows.map(r => [r.key, r.value])) }
  const user = userRows[0]

  if (!user) redirect('/login')

  if (config.inscription_enabled !== 'true') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gradient-gold">Inscripción</h1>
        <div className="glass-card p-8 text-center text-muted-foreground rounded-xl">
          <p className="text-3xl mb-3">🔒</p>
          <p>La inscripción no está habilitada en este torneo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Inscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">Confirma tu participación en el torneo</p>
      </div>
      <InscripcionClient
        inscriptionStatus={user.inscriptionStatus ?? 'pending'}
        inscriptionNotes={user.inscriptionNotes}
        rulesText={config.rules_text ?? ''}
        requirements={config.inscription_requirements ?? ''}
        fee={parseInt(config.inscription_fee ?? '0') || 0}
        currency={config.inscription_currency ?? 'CLP'}
      />
    </div>
  )
}
