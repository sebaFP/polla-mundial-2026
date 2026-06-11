'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import QRCodeDisplay from './QRCodeDisplay'
import { Link2, LockOpen, Lock } from 'lucide-react'

type Member = {
  userId: string
  role: string
  inscriptionStatus: string
  inscriptionNotes: string | null
  name: string
  email: string | null
  avatarColor: string | null
  totalPoints: number
  predictedMatches: number
  qrToken: string | null
  groupPredCount: number
  specialPredCount: number
  questionsAnswered: number
  predictionUnlocked: boolean
}

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

type Props = {
  pollaId: string
  pollaSlug: string
  initialParticipants: Member[]
  inscriptionEnabled: boolean
  inscriptionFee: number
  inscriptionCurrency: string
  prizePoolEnabled: boolean
  prize1Pct: number
  prize2Pct: number
  prize3Pct: number
  featureGroupPredictions: boolean
  featureSpecialPredictions: boolean
  featureCustomQuestions: boolean
  totalQuestions: number
}

export default function PollaParticipantsManager({
  pollaId,
  pollaSlug,
  initialParticipants,
  inscriptionEnabled,
  inscriptionFee,
  inscriptionCurrency,
  prizePoolEnabled,
  prize1Pct,
  prize2Pct,
  prize3Pct,
  featureGroupPredictions,
  featureSpecialPredictions,
  featureCustomQuestions,
  totalQuestions,
}: Props) {
  const [participants, setParticipants] = useState(initialParticipants)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedQR, setSelectedQR] = useState<Member | null>(null)

  const apiBase = `/api/pollas/${pollaId}/members`

  async function createParticipant(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setParticipants(prev => [...prev, { ...data, totalPoints: 0, predictedMatches: 0, groupPredCount: 0, specialPredCount: 0, questionsAnswered: 0 }])
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
    if (!confirm(`¿Eliminar a ${userName}? Se borrarán sus pronósticos de esta polla.`)) return
    try {
      const res = await fetch(apiBase, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) { toast.error('Error al eliminar'); return }
      setParticipants(prev => prev.filter(p => p.userId !== userId))
      toast.success('Participante eliminado')
    } catch {
      toast.error('Error')
    }
  }

  async function updateInscription(userId: string, status: InscriptionStatus) {
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, inscriptionStatus: status }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, inscriptionStatus: status } : p))
      toast.success(`Estado: ${STATUS_LABELS[status]}`)
    } catch {
      toast.error('Error')
    }
  }

  async function togglePredictionUnlock(userId: string, currentUnlocked: boolean) {
    const next = !currentUnlocked
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, predictionUnlocked: next }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, predictionUnlocked: next } : p))
      toast.success(next ? 'Pronósticos desbloqueados' : 'Pronósticos bloqueados')
    } catch {
      toast.error('Error')
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function copyJoinLink() {
    const url = `${window.location.origin}/join/polla/${pollaSlug}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('¡Enlace de invitación copiado!')
    }).catch(() => {
      toast.error('No se pudo copiar el enlace')
    })
  }
  const approvedCount = participants.filter(p => p.inscriptionStatus === 'approved').length
  const totalPool = approvedCount * inscriptionFee

  return (
    <div className="space-y-6">
      {/* Add participant form */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Agregar Participante por QR</CardTitle>
            <Button variant="outline" size="sm" onClick={copyJoinLink} className="text-xs gap-1.5 shrink-0">
              <Link2 className="h-3.5 w-3.5" />
              Copiar enlace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={createParticipant} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-36">
              <Label htmlFor="pname">Nombre *</Label>
              <Input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del participante" required />
            </div>
            <div className="space-y-1.5 flex-1 min-w-36">
              <Label htmlFor="pemail">Email (opcional)</Label>
              <Input id="pemail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
            </div>
            <Button type="submit" disabled={creating} className="font-bold">
              {creating ? 'Creando...' : '+ Agregar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      {inscriptionEnabled && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['pending', 'confirmed', 'approved', 'rejected'] as InscriptionStatus[]).map(s => (
            <Card key={s} className="glass-card text-center p-3">
              <p className="text-2xl font-black text-primary">{participants.filter(p => (p.inscriptionStatus ?? 'pending') === s).length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{STATUS_LABELS[s]}</p>
            </Card>
          ))}
        </div>
      )}

      {prizePoolEnabled && inscriptionFee > 0 && (
        <Card className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Pozo Total</p>
          <p className="text-3xl font-black text-gradient-gold">{inscriptionCurrency} {totalPool.toLocaleString('es-CL')}</p>
          <div className="flex justify-center gap-4 text-xs mt-2">
            <span>1°: {prize1Pct}%</span>
            <span>2°: {prize2Pct}%</span>
            <span>3°: {prize3Pct}%</span>
          </div>
        </Card>
      )}

      {/* Participants list */}
      <div className="space-y-2">
        {participants.sort((a, b) => b.totalPoints - a.totalPoints).map(p => (
          <Card key={p.userId} className="glass-card p-3">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback style={{ backgroundColor: p.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                  {p.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  {p.role === 'admin' && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 shrink-0 font-bold">
                      Admin
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  {inscriptionEnabled && (
                    <Badge className={`text-xs border ${STATUS_COLORS[(p.inscriptionStatus ?? 'pending') as InscriptionStatus]}`}>
                      {STATUS_LABELS[(p.inscriptionStatus ?? 'pending') as InscriptionStatus]}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{p.totalPoints} pts</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <Badge className={`text-[10px] border px-1.5 py-0 ${p.predictedMatches > 0 ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-muted-foreground/20'}`}>
                    {p.predictedMatches > 0 ? `${p.predictedMatches} partidos` : 'Sin partidos'}
                  </Badge>
                  {featureGroupPredictions && (
                    <Badge className={`text-[10px] border px-1.5 py-0 ${p.groupPredCount > 0 ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-muted-foreground/20'}`}>
                      {p.groupPredCount > 0 ? 'Grupos ✓' : 'Grupos ✗'}
                    </Badge>
                  )}
                  {featureSpecialPredictions && (
                    <Badge className={`text-[10px] border px-1.5 py-0 ${p.specialPredCount > 0 ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-muted-foreground/20'}`}>
                      {p.specialPredCount > 0 ? 'Especiales ✓' : 'Especiales ✗'}
                    </Badge>
                  )}
                  {featureCustomQuestions && (
                    <Badge className={`text-[10px] border px-1.5 py-0 ${p.questionsAnswered > 0 ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-muted-foreground/20'}`}>
                      {p.questionsAnswered > 0 ? `${p.questionsAnswered}/${totalQuestions} preguntas` : 'Preguntas ✗'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                {p.qrToken && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedQR(p)}>
                    QR
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs ${p.predictionUnlocked ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10' : 'text-muted-foreground'}`}
                  title={p.predictionUnlocked ? 'Bloquear pronósticos' : 'Desbloquear pronósticos'}
                  onClick={() => togglePredictionUnlock(p.userId, p.predictionUnlocked)}
                >
                  {p.predictionUnlocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </Button>
                {p.role === 'admin' ? (
                  <span className="text-xs text-muted-foreground self-center px-2">
                    Gestionado en Admins
                  </span>
                ) : (
                  <>
                    {inscriptionEnabled && (
                      <select
                        value={p.inscriptionStatus ?? 'pending'}
                        onChange={e => updateInscription(p.userId, e.target.value as InscriptionStatus)}
                        className="text-xs bg-background border border-border rounded px-1 py-0.5"
                      >
                        {(Object.keys(STATUS_LABELS) as InscriptionStatus[]).map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    )}
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => deleteParticipant(p.userId, p.name)}>
                      ✕
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {participants.length === 0 && (
          <Card className="glass-card p-8 text-center text-muted-foreground">
            No hay participantes aún
          </Card>
        )}
      </div>

      {/* QR Modal */}
      {selectedQR && (
        <Dialog open onOpenChange={() => setSelectedQR(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>QR — {selectedQR.name}</DialogTitle>
            </DialogHeader>
            {selectedQR.qrToken && (
              <QRCodeDisplay
                token={selectedQR.qrToken}
                name={selectedQR.name}
                appUrl={appUrl}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
