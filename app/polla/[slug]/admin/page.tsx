import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { pollaMembers } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const revalidate = 0

export default async function PollaAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const myRole = await getMemberRole(polla.id, session.userId)
  if (myRole !== 'admin') redirect(`/polla/${slug}/predictions`)

  const base = `/polla/${slug}/admin`

  const [{ total }, { participants }, { admins }] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(pollaMembers).where(eq(pollaMembers.pollaId, polla.id)).then(r => r[0]),
    db.select({ participants: sql<number>`COUNT(*)` })
      .from(pollaMembers)
      .where(
        and(
          eq(pollaMembers.pollaId, polla.id),
          sql`(${pollaMembers.role} = 'participant' OR (${pollaMembers.role} = 'admin' AND ${pollaMembers.inscriptionStatus} = 'approved'))`
        )
      )
      .then(r => r[0]),
    db.select({ admins: sql<number>`COUNT(*)` }).from(pollaMembers).where(and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.role, 'admin'))).then(r => r[0]),
  ])

  const cards = [
    { href: `${base}/participants`, label: '👥 Participantes', value: Number(participants), description: 'Gestionar participantes y sus QR' },
    { href: `${base}/admins`, label: '🔐 Admins', value: Number(admins), description: 'Promover/remover administradores' },
    { href: `${base}/results`, label: '⚽ Resultados', value: null, description: 'Ingresar resultados manualmente' },
    { href: `${base}/group-standings`, label: '🏆 Clasificación Grupos', value: null, description: 'Ver standings y fijar 1°/2°/3° por grupo' },
    { href: `${base}/config`, label: '⚙️ Config', value: null, description: 'Puntos, inscripción, pozo' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">{polla.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {Number(total)} miembro{Number(total) !== 1 ? 's' : ''} en la polla
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(c => (
          <Link key={c.href} href={c.href}>
            <Card className="glass-card hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {c.value !== null && (
                  <p className="text-3xl font-black text-primary mb-1">{c.value}</p>
                )}
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
