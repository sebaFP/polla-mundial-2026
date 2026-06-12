import { getSession } from '@/lib/auth/session'
import { getPollaBySlug } from '@/lib/polla'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { pollaMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import PollaAdminsManager from '@/components/admin/PollaAdminsManager'

export const revalidate = 0

export default async function PollaAdminsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const [admins, participants] = await Promise.all([
    db.select({
      userId: pollaMembers.userId,
      role: pollaMembers.role,
      inscriptionStatus: pollaMembers.inscriptionStatus,
      joinedAt: pollaMembers.joinedAt,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
    })
      .from(pollaMembers)
      .innerJoin(users, eq(pollaMembers.userId, users.id))
      .where(and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.role, 'admin'))),
    db.select({
      userId: pollaMembers.userId,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
    })
      .from(pollaMembers)
      .innerJoin(users, eq(pollaMembers.userId, users.id))
      .where(and(eq(pollaMembers.pollaId, polla.id), eq(pollaMembers.role, 'participant'))),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Administradores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona quién puede administrar esta polla
        </p>
      </div>
      <PollaAdminsManager
        pollaId={polla.id}
        initialAdmins={admins}
        initialParticipants={participants}
        currentUserId={session.userId}
        pollaCreatedBy={polla.createdBy}
      />
    </div>
  )
}
