'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function JoinPollaRequestForm({
  pollaId,
  pollaName,
}: {
  pollaId: string
  pollaName: string
}) {
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState(false)

  async function handleJoin() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/join-request`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al solicitar unirse')
        return
      }
      setJoined(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (joined) {
    return (
      <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
        <CardHeader>
          <CardTitle className="text-xl font-bold">¡Solicitud enviada!</CardTitle>
          <CardDescription>
            Tu solicitud para unirte a <span className="font-semibold text-foreground">{pollaName}</span> fue enviada.
            Un administrador debe aprobarte para que puedas acceder.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Unirte a {pollaName}</CardTitle>
        <CardDescription>
          Tu solicitud quedará pendiente hasta que un administrador la apruebe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full font-bold tracking-wide"
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'SOLICITAR UNIRSE'}
        </Button>
      </CardContent>
    </Card>
  )
}
