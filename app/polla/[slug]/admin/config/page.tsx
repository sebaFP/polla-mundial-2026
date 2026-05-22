import { getSession } from '@/lib/auth/session'
import { getPollaBySlug, getPollaConfig } from '@/lib/polla'
import { redirect } from 'next/navigation'
import ConfigPanel from '@/components/admin/ConfigPanel'

export const revalidate = 0

export default async function PollaConfigPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  if (!polla) redirect('/')

  const config = await getPollaConfig(polla.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Configuración de Reglas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define los puntos para cada tipo de pronóstico y activa/desactiva funcionalidades
        </p>
      </div>
      <ConfigPanel initialConfig={config} pollaId={polla.id} />
    </div>
  )
}
