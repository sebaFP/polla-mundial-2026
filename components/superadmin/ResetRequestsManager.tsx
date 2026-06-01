'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ResetRequest = {
  id: string
  email: string
  message: string
  status: string
  createdAt: Date | string | null
  resolvedAt: Date | string | null
  userId: string | null
  userName: string | null
}

export default function ResetRequestsManager({ initialRequests }: { initialRequests: ResetRequest[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [resolving, setResolving] = useState<string | null>(null)
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status === 'resolved')

  async function resolveRequest(req: ResetRequest) {
    if (!req.userId) {
      toast.error('No hay usuario registrado con ese email')
      return
    }
    setResolving(req.id)
    try {
      const res = await fetch(`/api/superadmin/reset-requests/${req.id}/resolve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al resolver')
        return
      }
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString() } : r))
      setTempPasswords(prev => ({ ...prev, [req.id]: data.tempPassword }))
      toast.success('Contraseña restablecida')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setResolving(null)
    }
  }

  function formatDate(d: Date | string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
  }

  function RequestCard({ req }: { req: ResetRequest }) {
    const tempPwd = tempPasswords[req.id]
    const isUnknownUser = !req.userId

    return (
      <Card className="glass-card">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  {req.userName ?? <span className="text-muted-foreground italic">Usuario no encontrado</span>}
                </span>
                <Badge variant={req.status === 'pending' ? 'destructive' : 'secondary'} className="text-xs">
                  {req.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                </Badge>
                {isUnknownUser && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/40">Sin cuenta</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{req.email}</p>
              <p className="text-xs text-muted-foreground">{formatDate(req.createdAt)}</p>
            </div>

            {req.status === 'pending' && !isUnknownUser && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-green-400 border-green-400/30 hover:bg-green-400/10"
                onClick={() => resolveRequest(req)}
                disabled={resolving === req.id}
              >
                {resolving === req.id ? 'Restableciendo...' : 'Restablecer'}
              </Button>
            )}
          </div>

          <div className="rounded-md bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Mensaje</p>
            <p className="text-sm whitespace-pre-wrap">{req.message}</p>
          </div>

          {tempPwd && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 space-y-1">
              <p className="text-xs text-amber-400 font-medium uppercase tracking-wide">Contraseña temporal</p>
              <p className="font-mono font-bold text-amber-300 select-all text-sm">{tempPwd}</p>
              <p className="text-xs text-muted-foreground">El usuario deberá cambiarla al iniciar sesión.</p>
            </div>
          )}

          {req.status === 'resolved' && req.resolvedAt && (
            <p className="text-xs text-muted-foreground">Resuelto: {formatDate(req.resolvedAt)}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No hay solicitudes pendientes.</p>
        ) : (
          pending.map(req => <RequestCard key={req.id} req={req} />)
        )}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Resueltas ({resolved.length})
          </h2>
          {resolved.map(req => <RequestCard key={req.id} req={req} />)}
        </section>
      )}
    </div>
  )
}
