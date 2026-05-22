'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Props = {
  inscriptionStatus: string
  inscriptionNotes: string | null
  rulesText: string
  requirements: string
  fee: number
  currency: string
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: string; message: string }> = {
  pending: { label: 'Pendiente', color: 'bg-muted text-muted-foreground', icon: '⏳', message: 'Aún no has confirmado tu inscripción.' },
  confirmed: { label: 'En revisión', color: 'bg-blue-500/20 text-blue-400', icon: '🔍', message: 'Tu inscripción está siendo revisada por el administrador.' },
  approved: { label: 'Aprobado', color: 'bg-green-500/20 text-green-400', icon: '✅', message: '¡Tu inscripción fue aprobada! Estás participando oficialmente.' },
  rejected: { label: 'Rechazado', color: 'bg-destructive/20 text-destructive', icon: '❌', message: 'Tu inscripción fue rechazada. Contacta al administrador.' },
}

export default function InscripcionClient({ inscriptionStatus, inscriptionNotes, rulesText, requirements, fee, currency }: Props) {
  const [status, setStatus] = useState(inscriptionStatus)
  const [confirming, setConfirming] = useState(false)

  const info = STATUS_INFO[status] ?? STATUS_INFO.pending

  async function confirmInscription() {
    setConfirming(true)
    try {
      const res = await fetch('/api/participant/inscription', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setStatus('confirmed')
      toast.success('Inscripción confirmada. El admin revisará tu solicitud.')
    } catch {
      toast.error('Error al confirmar')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Status card */}
      <Card className="glass-card">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{info.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold">Estado de Inscripción</p>
                <Badge variant="outline" className={info.color}>{info.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{info.message}</p>
              {status === 'rejected' && inscriptionNotes && (
                <p className="text-sm text-destructive mt-1">Nota del admin: {inscriptionNotes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee info */}
      {fee > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Cuota de Inscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gradient-gold">
              {currency} {fee.toLocaleString('es-CL')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      {requirements && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📋 Requisitos de Inscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-muted-foreground">{requirements}</pre>
          </CardContent>
        </Card>
      )}

      {/* Rules preview */}
      {rulesText && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📖 Reglamento</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-muted-foreground max-h-60 overflow-y-auto">{rulesText}</pre>
          </CardContent>
        </Card>
      )}

      {/* Confirm button */}
      {status === 'pending' && (
        <Card className="glass-card border-primary/30">
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Al confirmar, declaras que has leído el reglamento y cumplirás con los requisitos de inscripción.
            </p>
            <Button className="w-full" onClick={confirmInscription} disabled={confirming}>
              {confirming ? 'Confirmando...' : 'Confirmar Inscripción'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
