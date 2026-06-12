'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Crown, UserMinus, UserPlus } from 'lucide-react'

type Member = {
  userId: string
  name: string
  email: string | null
  avatarColor: string | null
}

type Admin = Member & {
  role: string
  inscriptionStatus: string
}

type Props = {
  pollaId: string
  initialAdmins: Admin[]
  initialParticipants: Member[]
  currentUserId: string
  pollaCreatedBy: string
}

export default function PollaAdminsManager({
  pollaId,
  initialAdmins,
  initialParticipants,
  currentUserId,
  pollaCreatedBy,
}: Props) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [participants, setParticipants] = useState(initialParticipants)
  const [open, setOpen] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [demoting, setDemoting] = useState<string | null>(null)

  async function promote(member: Member) {
    setPromoting(member.userId)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admins/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setAdmins(prev => [...prev, { ...member, role: 'admin', inscriptionStatus: data.inscriptionStatus ?? 'pending' }])
      setParticipants(prev => prev.filter(p => p.userId !== member.userId))
      toast.success(`${member.name} es ahora admin`)
      if (participants.length <= 1) setOpen(false)
    } catch {
      toast.error('Error')
    } finally {
      setPromoting(null)
    }
  }

  async function demote(admin: Admin) {
    if (admin.userId === pollaCreatedBy) {
      toast.error('No se puede quitar el rol al creador de la polla')
      return
    }
    if (admin.userId === currentUserId) {
      toast.error('No puedes quitarte el rol de admin a ti mismo')
      return
    }
    if (admins.length <= 1) {
      toast.error('Debe quedar al menos un administrador')
      return
    }
    if (!confirm(`¿Quitar rol de admin a ${admin.name}? Pasará a ser participante.`)) return
    setDemoting(admin.userId)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: admin.userId, role: 'participant' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setAdmins(prev => prev.filter(a => a.userId !== admin.userId))
      setParticipants(prev => [...prev, { userId: admin.userId, name: admin.name, email: admin.email, avatarColor: admin.avatarColor }])
      toast.success(`${admin.name} ya no es admin`)
    } catch {
      toast.error('Error')
    } finally {
      setDemoting(null)
    }
  }

  async function toggleParticipation(userId: string, current: string) {
    const next = current === 'approved' ? 'pending' : 'approved'
    try {
      const res = await fetch(`/api/pollas/${pollaId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, inscriptionStatus: next }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setAdmins(prev => prev.map(a => a.userId === userId ? { ...a, inscriptionStatus: next } : a))
      toast.success(next === 'approved' ? 'Admin contabilizado como jugador' : 'Admin excluido del marcador')
    } catch {
      toast.error('Error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Admins actuales ({admins.length})
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="sm" disabled={participants.length === 0}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                Agregar admin
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hacer admin a un participante</DialogTitle>
            </DialogHeader>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay participantes disponibles
              </p>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2 pr-3">
                  {participants.map(p => (
                    <div key={p.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback style={{ backgroundColor: p.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                          {p.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={promoting === p.userId}
                        onClick={() => promote(p)}
                      >
                        {promoting === p.userId ? '...' : 'Hacer admin'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {admins.map(a => {
          const isCreator = a.userId === pollaCreatedBy
          const isMe = a.userId === currentUserId
          const canDemote = !isCreator && !isMe && admins.length > 1

          return (
            <Card key={a.userId} className="glass-card p-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback style={{ backgroundColor: a.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                    {a.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    {isCreator && (
                      <Badge variant="outline" className="text-xs gap-1 border-yellow-500/50 text-yellow-400">
                        <Crown className="w-3 h-3" /> Creador
                      </Badge>
                    )}
                    {isMe && !isCreator && <Badge className="text-xs">Tú</Badge>}
                  </div>
                  {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={a.inscriptionStatus === 'approved' ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => toggleParticipation(a.userId, a.inscriptionStatus)}
                    title={a.inscriptionStatus === 'approved' ? 'Excluir del marcador' : 'Incluir en marcador'}
                  >
                    {a.inscriptionStatus === 'approved' ? 'Juega' : 'No juega'}
                  </Button>
                  {canDemote && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={demoting === a.userId}
                      onClick={() => demote(a)}
                    >
                      <UserMinus className="w-3.5 h-3.5 mr-1" />
                      {demoting === a.userId ? '...' : 'Quitar admin'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
