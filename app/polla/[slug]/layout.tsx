import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'
import PollaNav from '@/components/PollaNav'
import { db } from '@/lib/db'
import { passwordResetRequests } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export default async function PollaLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
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
        />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  )
}
