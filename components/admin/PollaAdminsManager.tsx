'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Admin = {
  userId: string
  role: string
  inscriptionStatus: string
  name: string
  email: string | null
  avatarColor: string | null
}

type Props = {
  pollaId: string
  initialAdmins: Admin[]
  currentUserId: string
}

export default function PollaAdminsManager({ pollaId, initialAdmins, currentUserId }: Props) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [searchEmail, setSearchEmail] = useState('')
  const [promoting, setPromoting] = useState(false)

  const apiBase = `/api/pollas/${pollaId}/members`

  async function promoteByEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setPromoting(true)
    try {
      // First, find if this email belongs to a participant in this polla
      // We'll use the members API to search
      const res = await fetch(`/api/pollas/${pollaId}/admins/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: searchEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setAdmins(prev => [...prev, data])
      setSearchEmail('')
      toast.success(`${data.name} es ahora admin`)
    } catch {
      toast.error('Error')
    } finally {
      setPromoting(false)
    }
  }

  async function demote(userId: string, userName: string) {
    if (userId === currentUserId) { toast.error('No puedes quitarte el rol de admin a ti mismo'); return }
    if (!confirm(`¿Quitar rol de admin a ${userName}? Pasará a ser participante.`)) return
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'participant' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setAdmins(prev => prev.filter(a => a.userId !== userId))
      toast.success(`${userName} ya no es admin`)
    } catch {
      toast.error('Error')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Invitar Admin por Email</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={promoteByEmail} className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1.5 flex-1 min-w-48">
              <Label htmlFor="admin-email">Email del usuario</Label>
              <Input
                id="admin-email"
                type="email"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                placeholder="usuario@email.com"
                required
              />
            </div>
            <Button type="submit" disabled={promoting} className="font-bold">
              {promoting ? 'Buscando...' : 'Hacer Admin'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            El usuario debe tener una cuenta registrada. Si ya es participante de la polla, se promoverá.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Admins actuales</h2>
        {admins.map(a => (
          <Card key={a.userId} className="glass-card p-3">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback style={{ backgroundColor: a.avatarColor ?? '#f59e0b', color: '#000' }} className="text-xs font-bold">
                  {a.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{a.name}</p>
                  {a.userId === currentUserId && <Badge className="text-xs">Tú</Badge>}
                </div>
                {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
              </div>
              {a.userId !== currentUserId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => demote(a.userId, a.name)}
                >
                  Quitar admin
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
