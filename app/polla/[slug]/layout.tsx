import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import PollaNav from '@/components/PollaNav'
import PublicPollaNav from '@/components/PublicPollaNav'
import { db } from '@/lib/db'
import { passwordResetRequests, pollaMembers } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export default async function PollaLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const session = await getSession()
  const { slug } = await params

  if (!session) {
    // Unauthenticated: only allow public leaderboard
    const polla = await getPollaBySlug(slug)
    if (!polla) redirect('/')

    const config = await getPollaConfig(polla.id)
    if (config.polla_visibility !== 'public') redirect('/login')

    // Public read-only layout — filtered nav, no membership check
    return (
      <div className="relative min-h-screen gradient-bg overflow-x-hidden">
        <div className="pattern-geo absolute inset-0" aria-hidden />
        <div className="relative z-10">
          <PublicPollaNav pollaName={polla.name} pollaSlug={slug} />
          <main className="container mx-auto px-4 py-6 max-w-6xl">
            {children}
          </main>
        </div>
      </div>
    )
  }

  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const myRole = await getMemberRole(polla.id, session.userId)
  if (!myRole) redirect('/')

  let pendingResetCount = 0
  if (session.isSuperAdmin) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(passwordResetRequests)
      .where(eq(passwordResetRequests.status, 'pending'))
    pendingResetCount = value
  }

  const [{ value: pollaCount }] = await db
    .select({ value: count() })
    .from(pollaMembers)
    .where(eq(pollaMembers.userId, session.userId))

  return (
    <div className="relative min-h-screen gradient-bg overflow-x-hidden">
      <div className="pattern-geo absolute inset-0" aria-hidden />
      <div className="relative z-10">
        <PollaNav
          userName={session.name}
          pollaName={polla.name}
          pollaSlug={slug}
          myRole={myRole}
          isSuperAdmin={session.isSuperAdmin}
          pendingResetCount={pendingResetCount}
          pollaCount={pollaCount}
        />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  )
}
