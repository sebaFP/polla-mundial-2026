'use client'

import { useState } from 'react'
import { User } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import QRCodeDisplay from './QRCodeDisplay'

type Participant = User & { totalPoints: number; predictedMatches: number; qrToken: string | null }

type InscriptionStatus = 'pending' | 'confirmed' | 'approved' | 'rejected'

const STATUS_LABELS: Record<InscriptionStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

const STATUS_COLORS: Record<InscriptionStatus, string> = {
  pending: 'bg-muted text-muted-foreground border-muted-foreground/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-destructive/20 text-destructive border-destructive/30',
}

const FILTER_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'approved', label: 'Aprobados' },
  { id: 'rejected', label: 'Rechazados' },
]

type Props = {
  initialParticipants: Participant[]
  inscriptionEnabled: boolean
  inscriptionFee: number
  inscriptionCurrency: string
  prizePoolEnabled: boolean
  prize1Pct: number
  prize2Pct: number
  prize3Pct: number
}

export default function ParticipantsManager({
  initialParticipants,
  inscriptionEnabled,
  inscriptionFee,
  inscriptionCurrency,
  prizePoolEnabled,
  prize1Pct,
  prize2Pct,
  prize3Pct,
}: Props) {
  const [participants, setParticipants] = useState(initialParticipants)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedQR, setSelectedQR] = useState<Participant | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [notesModal, setNotesModal] = useState<Participant | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

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

  async function updateInscription(userId: string, status: InscriptionStatus, notes?: string) {
    try {
      const res = await fetch(`/api/admin/participants/${userId}/inscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(notes !== undefined ? { notes } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setParticipants(prev => prev.map(p => p.id === userId ? { ...p, inscriptionStatus: data.inscriptionStatus, inscriptionNotes: data.inscriptionNotes } : p))
      toast.success(`Estado actualizado: ${STATUS_LABELS[status]}`)
    } catch {
      toast.error('Error')
    }
  }

  async function saveNotes() {
    if (!notesModal) return
    setSavingNotes(true)
    try {
      await updateInscription(notesModal.id, (notesModal.inscriptionStatus ?? 'pending') as InscriptionStatus, notesText)
      setParticipants(prev => prev.map(p => p.id === notesModal.id ? { ...p, inscriptionNotes: notesText || null } : p))
      setNotesModal(null)
    } finally {
      setSavingNotes(false)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const approvedCount = participants.filter(p => p.inscriptionStatus === 'approved').length
  const confirmedCount = participants.filter(p => p.inscriptionStatus === 'confirmed').length
  const pendingCount = participants.filter(p => !p.inscriptionStatus || p.inscriptionStatus === 'pending').length
  const rejectedCount = participants.filter(p => p.inscriptionStatus === 'rejected').length
  const totalPool = approvedCount * inscriptionFee

  const filtered = participants
    .filter(p => {
      if (filterStatus === 'all') return true
      const status = p.inscriptionStatus ?? 'pending'
      return status === filterStatus
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  function formatAmount(n: number) {
    return `${inscriptionCurrency} ${n.toLocaleString('es-CL')}`
  }

  return (
    <div className="space-y-6">
      {/* Prize pool summary */}
      {inscriptionEnabled && prizePoolEnabled && inscriptionFee > 0 && (
        <Card className="glass-card border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pozo Total</p>
                <p className="text-3xl font-bold text-gradient-gold">{formatAmount(totalPool)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{approvedCount} participantes × {formatAmount(inscriptionFee)}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-amber-400">{formatAmount(Math.round(totalPool * prize1Pct / 100))}</p>
                  <p className="text-xs text-muted-foreground">🥇 1°</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-300">{formatAmount(Math.round(totalPool * prize2Pct / 100))}</p>
                  <p className="text-xs text-muted-foreground">🥈 2°</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-orange-400">{formatAmount(Math.round(totalPool * prize3Pct / 100))}</p>
                  <p className="text-xs text-muted-foreground">🥉 3°</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inscription stats */}
      {inscriptionEnabled && (
        <div className="grid grid-cols-4 gap-2">
          <Card className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </Card>
          <Card className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </Card>
          <Card className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Aprobados</p>
          </Card>
          <Card className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Rechazados</p>
          </Card>
        </div>
      )}

      {/* Add participant form */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agregar Participante</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createParticipant} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-40">
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input placeholder="Juan Pérez" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="flex-1 min-w-40">
              <Label className="text-xs mb-1 block">Email (opcional)</Label>
              <Input type="email" placeholder="juan@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>{creating ? 'Agregando...' : '+ Agregar'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      {inscriptionEnabled && (
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Participants list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{filtered.length} participantes{filterStatus !== 'all' ? ` (${STATUS_LABELS[filterStatus as InscriptionStatus]})` : ''}</p>
        </div>

        {filtered.length === 0 && (
          <Card className="glass-card p-8 text-center text-muted-foreground">
            <p className="text-3xl mb-2">👥</p>
            <p>No hay participantes en este filtro</p>
          </Card>
        )}

        {filtered.map((p, i) => {
          const status = (p.inscriptionStatus ?? 'pending') as InscriptionStatus
          return (
            <Card key={p.id} className="glass-card p-3">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground w-5 text-center font-mono">{i + 1}</div>

                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback style={{ backgroundColor: p.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    {inscriptionEnabled && (
                      <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    )}
                  </div>
                  {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  {inscriptionEnabled && p.inscriptionNotes && (
                    <p className="text-xs text-muted-foreground/70 italic truncate">📝 {p.inscriptionNotes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{p.predictedMatches} pronósticos</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-primary font-mono">{p.totalPoints} pts</p>
                </div>

                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {inscriptionEnabled && (
                    <>
                      {status !== 'approved' && (
                        <Button size="sm" variant="outline" className="text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => updateInscription(p.id, 'approved')}>
                          Aprobar
                        </Button>
                      )}
                      {status !== 'rejected' && (
                        <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => updateInscription(p.id, 'rejected')}>
                          Rechazar
                        </Button>
                      )}
                      {status === 'rejected' && (
                        <Button size="sm" variant="outline" className="text-xs"
                          onClick={() => updateInscription(p.id, 'pending')}>
                          Reabrir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setNotesModal(p); setNotesText(p.inscriptionNotes ?? '') }}>
                        Notas
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedQR(p)}>QR</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteParticipant(p.id, p.name)}>
                    ✕
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* QR Modal */}
      <Dialog open={!!selectedQR} onOpenChange={open => !open && setSelectedQR(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>QR de Acceso — {selectedQR?.name}</DialogTitle>
          </DialogHeader>
          {selectedQR?.qrToken && (
            <QRCodeDisplay token={selectedQR.qrToken} name={selectedQR.name} appUrl={appUrl} />
          )}
        </DialogContent>
      </Dialog>

      {/* Notes Modal */}
      <Dialog open={!!notesModal} onOpenChange={open => !open && setNotesModal(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Notas — {notesModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Ej: Pagó el 20/05, comprobante recibido"
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              className="min-h-24"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setNotesModal(null)}>Cancelar</Button>
              <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? 'Guardando...' : 'Guardar Notas'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
