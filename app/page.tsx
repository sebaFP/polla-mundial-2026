import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { pollas, pollaMembers } from '@/lib/db/schema'
import { eq, inArray, and, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const revalidate = 0

export default async function HomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const memberships = await db.select({
    pollaId: pollaMembers.pollaId,
    role: pollaMembers.role,
  }).from(pollaMembers).where(eq(pollaMembers.userId, session.userId))

  let myPollas: Array<{ id: string; name: string; slug: string; description: string | null; myRole: string; memberCount: number }> = []

  if (memberships.length > 0) {
    const pollaIds = memberships.map(m => m.pollaId)
    const roleMap = Object.fromEntries(memberships.map(m => [m.pollaId, m.role]))

    const allPollas = await db.select().from(pollas).where(inArray(pollas.id, pollaIds))
    const counts = await db.select({ pollaId: pollaMembers.pollaId }).from(pollaMembers).where(
      and(
        inArray(pollaMembers.pollaId, pollaIds),
        sql`(${pollaMembers.role} = 'participant' OR (${pollaMembers.role} = 'admin' AND ${pollaMembers.inscriptionStatus} = 'approved'))`
      )
    )
    const countMap: Record<string, number> = {}
    for (const c of counts) countMap[c.pollaId] = (countMap[c.pollaId] ?? 0) + 1

    myPollas = allPollas.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      myRole: roleMap[p.id] ?? 'participant',
      memberCount: countMap[p.id] ?? 0,
    }))
  }

  return (
    <div className="relative min-h-screen gradient-bg overflow-x-hidden">
      <div className="pattern-geo absolute inset-0" aria-hidden />
      <div className="relative z-10">
        <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
          <div className="container mx-auto px-4 max-w-5xl flex h-13 items-center justify-between">
            <span className="text-base font-black tracking-tight leading-none">
              <span style={{ color: '#E61D25' }}>P</span>
              <span style={{ color: '#ffffff' }}>O</span>
              <span style={{ color: '#2A398D' }}>L</span>
              <span style={{ color: '#ffffff' }}>L</span>
              <span style={{ color: '#3CAC3B' }}>A</span>
              <span className="ml-1.5 text-muted-foreground font-bold">26</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{session.name}</span>
              <form action="/api/auth/logout" method="POST">
                <Button type="submit" variant="ghost" size="sm" className="text-xs font-semibold">
                  Salir
                </Button>
              </form>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gradient-gold">Mis Pollas</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Bienvenido, {session.name}
                </p>
              </div>
              <Link href="/polla/create">
                <Button className="font-bold">+ Nueva Polla</Button>
              </Link>
            </div>

            {myPollas.length === 0 ? (
              <Card className="glass-card p-10 text-center">
                <p className="text-4xl mb-4">🏆</p>
                <h2 className="text-lg font-bold mb-2">Aún no tienes pollas</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Crea una polla nueva o espera a que te inviten a una
                </p>
                <Link href="/polla/create">
                  <Button className="font-bold">Crear mi primera polla</Button>
                </Link>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myPollas.map(p => (
                  <Link key={p.id} href={`/polla/${p.slug}/predictions`}>
                    <Card className="glass-card hover:border-primary/40 transition-all cursor-pointer h-full group">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {p.name}
                          </CardTitle>
                          <Badge
                            className={p.myRole === 'admin'
                              ? 'bg-primary/20 text-primary border-primary/30 shrink-0'
                              : 'bg-muted text-muted-foreground shrink-0'}
                          >
                            {p.myRole === 'admin' ? 'Admin' : 'Participante'}
                          </Badge>
                        </div>
                        {p.description && (
                          <CardDescription className="text-xs">{p.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {p.memberCount} participante{p.memberCount !== 1 ? 's' : ''}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
