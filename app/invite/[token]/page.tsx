import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { pollaInviteLinks, pollas } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import RegisterForm from '@/components/auth/RegisterForm'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [link] = await db.select({
    token: pollaInviteLinks.token,
    pollaId: pollaInviteLinks.pollaId,
    label: pollaInviteLinks.label,
  }).from(pollaInviteLinks).where(
    and(
      eq(pollaInviteLinks.token, token),
      or(isNull(pollaInviteLinks.expiresAt), gt(pollaInviteLinks.expiresAt, new Date()))
    )
  ).limit(1)

  if (!link) redirect('/login?error=invalid-token')

  const [polla] = await db.select({ name: pollas.name }).from(pollas).where(eq(pollas.id, link.pollaId)).limit(1)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-gradient-gold">
            {polla?.name ?? 'Polla'}
          </h1>
          {link.label && <p className="text-sm text-muted-foreground">{link.label}</p>}
          <p className="text-sm text-muted-foreground">Ingresa tu nombre para unirte</p>
        </div>
        <RegisterForm token={token} />
      </div>
    </div>
  )
}
