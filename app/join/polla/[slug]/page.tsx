import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { getSession } from '@/lib/auth/session'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import JoinPollaRequestForm from '@/components/JoinPollaRequestForm'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  const name = polla?.name ?? 'Polla Mundial 2026'
  const competition = polla?.competitionName
  const description = competition
    ? `Te invitaron a ${name} (${competition}). Solicita unirte a la polla.`
    : `Te invitaron a ${name}. Solicita unirte a la polla.`
  return {
    title: `Únete a ${name}`,
    description,
    openGraph: { title: `Únete a ${name}`, description },
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de aprobación',
  confirmed: 'Confirmado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export default async function JoinPollaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) notFound()

  const session = await getSession()

  if (!session) {
    const redirectUrl = `/join/polla/${slug}`
    return (
      <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
        <div className="pattern-geo absolute inset-0" />
        <div className="relative z-10 w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <p className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">Invitación a</p>
            <h1 className="text-3xl font-black tracking-tight text-gradient-gold">{polla.name}</h1>
            {polla.competitionName && (
              <p className="text-sm text-muted-foreground">{polla.competitionName}</p>
            )}
          </div>
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Únete a la polla</CardTitle>
              <CardDescription>
                Inicia sesión o crea una cuenta para solicitar unirte a{' '}
                <span className="font-semibold text-foreground">{polla.name}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                className="inline-flex items-center justify-center w-full h-9 px-4 py-2 rounded-md text-sm font-bold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                INICIAR SESIÓN
              </Link>
              <Link
                href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
                className="inline-flex items-center justify-center w-full h-9 px-4 py-2 rounded-md text-sm font-bold tracking-wide border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                CREAR CUENTA
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const memberRole = await getMemberRole(polla.id, session.userId)

  if (memberRole !== null) {
    // Already a member — fetch inscription status
    const { db } = await import('@/lib/db')
    const { pollaMembers } = await import('@/lib/db/schema')
    const { and, eq } = await import('drizzle-orm')
    const [member] = await db.select({ inscriptionStatus: pollaMembers.inscriptionStatus })
      .from(pollaMembers)
      .where(and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.userId, session.userId)))
      .limit(1)

    const status = member?.inscriptionStatus ?? 'pending'

    if (status === 'approved') {
      redirect(`/polla/${slug}/predictions`)
    }

    const label = STATUS_LABELS[status] ?? status

    return (
      <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
        <div className="pattern-geo absolute inset-0" />
        <div className="relative z-10 w-full max-w-md space-y-6">
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">{polla.name}</CardTitle>
              <CardDescription>
                Ya eres miembro de esta polla. Estado: <span className="font-semibold text-foreground">{label}</span>
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="pattern-geo absolute inset-0" />
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">Invitación a</p>
          <h1 className="text-3xl font-black tracking-tight text-gradient-gold">{polla.name}</h1>
          <div className="flex items-center gap-3 justify-center">
            <div className="fifa-stripe flex-1 max-w-16" />
            <span className="text-xl font-black text-foreground/30 tracking-widest">2026</span>
            <div className="fifa-stripe flex-1 max-w-16" />
          </div>
        </div>
        <JoinPollaRequestForm pollaId={polla.id} pollaName={polla.name} />
      </div>
    </div>
  )
}
