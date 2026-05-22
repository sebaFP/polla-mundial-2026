import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'
import PollaAdminNav from '@/components/PollaAdminNav'

export default async function PollaAdminLayout({
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
  if (myRole !== 'admin') redirect(`/polla/${slug}/predictions`)

  return (
    <div className="min-h-screen gradient-bg">
      <PollaAdminNav
        userName={session.name}
        pollaName={polla.name}
        pollaSlug={slug}
      />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {children}
      </main>
    </div>
  )
}
