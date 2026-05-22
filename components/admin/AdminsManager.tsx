'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

type Admin = { id: string; name: string; email: string | null; createdAt: Date | string | null }

export default function AdminsManager({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: Admin[]
  currentUserId: string
}) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [changePwdFor, setChangePwdFor] = useState<Admin | null>(null)
  const [newPwd, setNewPwd] = useState('')

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setAdmins(prev => [...prev, data])
      setName(''); setEmail(''); setPassword('')
      toast.success(`Admin ${data.name} creado`)
    } catch { toast.error('Error') }
    finally { setCreating(false) }
  }

  async function deleteAdmin(admin: Admin) {
    if (!confirm(`¿Eliminar admin ${admin.name}?`)) return
    const res = await fetch('/api/admin/admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: admin.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    setAdmins(prev => prev.filter(a => a.id !== admin.id))
    toast.success('Admin eliminado')
  }

  async function changePassword() {
    if (!changePwdFor || !newPwd) return
    const res = await fetch('/api/admin/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: changePwdFor.id, password: newPwd }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    toast.success('Contraseña actualizada')
    setChangePwdFor(null); setNewPwd('')
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nuevo Administrador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createAdmin} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-32">
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input placeholder="María García" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="flex-1 min-w-40">
              <Label className="text-xs mb-1 block">Email *</Label>
              <Input type="email" placeholder="maria@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="flex-1 min-w-36">
              <Label className="text-xs mb-1 block">Contraseña * (mín. 8)</Label>
              <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>{creating ? 'Creando...' : '+ Agregar'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {admins.map(admin => (
          <Card key={admin.id} className="glass-card p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {admin.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{admin.name}</p>
                  {admin.id === currentUserId && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Tú</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{admin.email}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { setChangePwdFor(admin); setNewPwd('') }}>
                  🔑 Clave
                </Button>
                {admin.id !== currentUserId && (
                  <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteAdmin(admin)}>
                    ✕
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Change password modal */}
      <Dialog open={!!changePwdFor} onOpenChange={open => !open && setChangePwdFor(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña — {changePwdFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Nueva contraseña (mín. 8 chars)</Label>
              <Input type="password" placeholder="••••••••" value={newPwd} onChange={e => setNewPwd(e.target.value)} minLength={8} />
            </div>
            <Button className="w-full" onClick={changePassword} disabled={newPwd.length < 8}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
