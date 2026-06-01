'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type User = {
  id: string
  name: string
  email: string | null
  isSuperAdmin: boolean
  createdAt: Date | string | null
}

export default function UsersManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [resetting, setResetting] = useState<string | null>(null)
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})

  const isQrUser = (email: string | null) => email?.includes('@polla.internal') ?? false

  async function resetPassword(user: User) {
    if (!confirm(`¿Restablecer contraseña de ${user.name}? Se generará una contraseña temporal.`)) return
    setResetting(user.id)
    try {
      const res = await fetch(`/api/superadmin/users/${user.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al restablecer')
        return
      }
      setTempPasswords(prev => ({ ...prev, [user.id]: data.tempPassword }))
      toast.success(`Contraseña restablecida para ${user.name}`)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setResetting(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
      </p>

      {users.map(user => {
        const isQr = isQrUser(user.email)
        const tempPwd = tempPasswords[user.id]

        return (
          <Card key={user.id} className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{user.name}</span>
                    {user.isSuperAdmin && (
                      <Badge variant="secondary" className="text-xs">Super Admin</Badge>
                    )}
                    {isQr && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">QR</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {isQr ? 'Usuario QR (sin email real)' : (user.email ?? '—')}
                  </p>
                  {user.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Creado: {new Date(user.createdAt).toLocaleDateString('es-CL')}
                    </p>
                  )}
                  {tempPwd && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                      <p className="text-xs text-amber-400 font-mono">
                        Contraseña temporal: <span className="font-bold select-all">{tempPwd}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        El usuario deberá cambiarla al iniciar sesión.
                      </p>
                    </div>
                  )}
                </div>

                {!isQr && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
                    onClick={() => resetPassword(user)}
                    disabled={resetting === user.id}
                  >
                    {resetting === user.id ? 'Restableciendo...' : 'Restablecer contraseña'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {users.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No hay usuarios registrados.</p>
      )}
    </div>
  )
}
