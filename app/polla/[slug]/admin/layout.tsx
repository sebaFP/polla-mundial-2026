import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getMemberRole } from '@/lib/polla'
import { redirect } from 'next/navigation'

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

  return <>{children}</>
}
