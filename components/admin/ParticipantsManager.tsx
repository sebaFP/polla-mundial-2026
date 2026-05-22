'use client'

import { useState, useRef } from 'react'
import { User } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import QRCodeDisplay from './QRCodeDisplay'

type Participant = User & { totalPoints: number; predictedMatches: number; qrToken: string | null }

export default function ParticipantsManager({
  initialParticipants,
  initialAdmins,
}: {
  initialParticipants: Participant[]
  initialAdmins: User[]
}) {
  const [participants, setParticipants] = useState(initialParticipants)
  const [admins, setAdmins] = useState(initialAdmins)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedQR, setSelectedQR] = useState<Participant | null>(null)

  async function createParticipant(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setParticipants(prev => [...prev, { ...data, totalPoints: 0, predictedMatches: 0 }])
      setName('')
      setEmail('')
      toast.success(`¡${data.name} agregado!`)
    } catch {
      toast.error('Error al crear participante')
    } finally {
      setCreating(false)
    }
  }

  async function deleteParticipant(userId: string, userName: string) {
    if (!confirm(`¿Eliminar a ${userName}? Se borrarán todos sus pronósticos.`)) return
    try {
      const res = await fetch('/api/admin/participants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) { toast.error('Error al eliminar'); return }
      setParticipants(prev => prev.filter(p => p.id !== userId))
      toast.success('Participante eliminado')
    } catch {
      toast.error('Error')
    }
  }

  async function toggleAdminParticipation(userId: string, currentStatus: string | null) {
    setTogglingAdmin(userId)
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved'
    try {
      const res = await fetch('/api/admin/participants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, inscriptionStatus: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setAdmins(prev => prev.map(a => a.id === userId ? { ...a, inscriptionStatus: newStatus } : a))
      toast.success(newStatus === 'approved' ? 'Admin habilitado como participante' : 'Admin deshabilitado del pool')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setTogglingAdmin(null)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

  return (
    <div className="space-y-6">
      {/* Add participant form */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agregar Participante</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createParticipant} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-40">
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                placeholder="Juan Pérez"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1 min-w-40">
              <Label className="text-xs mb-1 block">Email (opcional)</Label>
              <Input
                type="email"
                placeholder="juan@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>
                {creating ? 'Agregando...' : '+ Agregar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Participants list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{participants.length} participantes</p>
        </div>

        {participants.length === 0 && (
          <Card className="glass-card p-8 text-center text-muted-foreground">
            <p className="text-3xl mb-2">👥</p>
            <p>Aún no hay participantes. ¡Agrega el primero!</p>
          </Card>
        )}

        {participants.sort((a, b) => b.totalPoints - a.totalPoints).map((p, i) => (
          <Card key={p.id} className="glass-card p-3">
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground w-5 text-center font-mono">{i + 1}</div>

              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback style={{ backgroundColor: p.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                  {p.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                <p className="text-xs text-muted-foreground">{p.predictedMatches} pronósticos</p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-primary font-mono">{p.totalPoints} pts</p>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setSelectedQR(p)}
                >
                  QR
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteParticipant(p.id, p.name)}
                >
                  ✕
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Admins section */}
      {admins.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm font-semibold text-muted-foreground">Administradores en el pool</p>
          <p className="text-xs text-muted-foreground">Los admins habilitados aparecen en el leaderboard y pueden hacer pronósticos.</p>
          {admins.map(a => {
            const isParticipant = a.inscriptionStatus === 'approved'
            return (
              <Card key={a.id} className="glass-card p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback style={{ backgroundColor: a.avatarColor ?? '#6366f1', color: '#fff' }} className="text-xs font-bold">
                      {a.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    {a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
                  </div>

                  <Badge variant={isParticipant ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {isParticipant ? 'Participante' : 'Solo admin'}
                  </Badge>

                  <Button
                    size="sm"
                    variant={isParticipant ? 'outline' : 'default'}
                    className="text-xs shrink-0"
                    disabled={togglingAdmin === a.id}
                    onClick={() => toggleAdminParticipation(a.id, a.inscriptionStatus)}
                  >
                    {togglingAdmin === a.id ? '...' : isParticipant ? 'Deshabilitar' : 'Habilitar'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* QR Modal */}
      <Dialog open={!!selectedQR} onOpenChange={open => !open && setSelectedQR(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>QR de Acceso — {selectedQR?.name}</DialogTitle>
          </DialogHeader>
          {selectedQR?.qrToken && (
            <QRCodeDisplay
              token={selectedQR.qrToken}
              name={selectedQR.name}
              appUrl={appUrl}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
