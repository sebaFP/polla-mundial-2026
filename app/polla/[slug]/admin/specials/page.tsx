import { db } from '@/lib/db'
import { specialPredictions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import SpecialsResultManager from '@/components/admin/SpecialsResultManager'

export const revalidate = 0

export default async function AdminSpecialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const config = await getPollaConfig(polla.id)

  const preds = await db.select({
    id: specialPredictions.id,
    userId: specialPredictions.userId,
    type: specialPredictions.type,
    teamName: specialPredictions.teamName,
    playerName: specialPredictions.playerName,
    points: specialPredictions.points,
    userName: users.name,
  })
    .from(specialPredictions)
    .leftJoin(users, eq(specialPredictions.userId, users.id))
    .where(eq(specialPredictions.pollaId, polla.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Resultados Especiales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define el resultado correcto para cada predicción especial y bonus
        </p>
      </div>
      <SpecialsResultManager
        pollaId={polla.id}
        config={config}
        predictions={preds}
      />
    </div>
  )
}
