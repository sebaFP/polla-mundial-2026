import { db } from '@/lib/db'
import { users, matches, predictions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60

export default async function AdminDashboard() {
  const [participantCount] = await db.select({ c: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, 'participant'))
  const [totalMatches] = await db.select({ c: sql<number>`COUNT(*)` }).from(matches)
  const [finishedMatches] = await db.select({ c: sql<number>`COUNT(*)` }).from(matches).where(eq(matches.status, 'FINISHED'))
  const [liveMatches] = await db.select({ c: sql<number>`COUNT(*)` }).from(matches).where(sql`${matches.status} IN ('IN_PLAY', 'PAUSED')`)
  const [totalPredictions] = await db.select({ c: sql<number>`COUNT(*)` }).from(predictions)

  const stats = [
    { label: 'Participantes', value: participantCount.c, icon: '👥', href: '/admin/participants' },
    { label: 'Partidos', value: `${finishedMatches.c}/${totalMatches.c}`, icon: '⚽', href: '/admin/results' },
    { label: 'En Vivo', value: liveMatches.c, icon: '🔴', href: '/admin/results' },
    { label: 'Pronósticos', value: totalPredictions.c, icon: '📊', href: null },
  ]

  const upcomingMatches = await db.select().from(matches)
    .where(eq(matches.status, 'SCHEDULED'))
    .orderBy(matches.matchDatetime)
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Panel de Control</h1>
        <p className="text-muted-foreground text-sm">Mundial FIFA 2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="glass-card">
            <CardContent className="p-4">
              {s.href ? (
                <Link href={s.href} className="block">
                  <p className="text-3xl mb-1">{s.icon}</p>
                  <p className="text-2xl font-bold text-primary font-mono">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </Link>
              ) : (
                <>
                  <p className="text-3xl mb-1">{s.icon}</p>
                  <p className="text-2xl font-bold text-primary font-mono">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { href: '/admin/participants', title: '👥 Gestionar Participantes', desc: 'Agregar, ver QR, eliminar' },
          { href: '/admin/results', title: '⚽ Ingresar Resultados', desc: 'Sync automático o manual' },
          { href: '/admin/config', title: '⚙️ Configurar Reglas', desc: 'Puntos, features, lock time' },
        ].map(l => (
          <Link key={l.href} href={l.href}>
            <Card className="glass-card hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <p className="font-semibold text-sm">{l.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximos Partidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingMatches.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                  <span className="text-muted-foreground text-xs">
                    {new Date(m.matchDatetime).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium">{m.team1} vs {m.team2}</span>
                  <Badge variant="outline" className="text-xs">{m.groupName ?? m.stage}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
