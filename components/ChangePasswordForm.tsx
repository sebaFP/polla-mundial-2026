'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ChangePasswordForm({ email, forcedChange = false }: { email: string; forcedChange?: boolean }) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const isQrUser = email.includes('@polla.internal')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error)
        return
      }
      toast.success('Contraseña actualizada')
      router.push('/')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="text-6xl">🔒</div>
          <h1 className="text-3xl font-bold text-gradient-gold">Cambiar contraseña</h1>
        </div>

        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-xl">Nueva contraseña</CardTitle>
            <CardDescription>
              {forcedChange
                ? 'Un administrador restableció tu contraseña. Debes crear una nueva antes de continuar.'
                : 'Mínimo 8 caracteres'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!forcedChange && (
              <div className="space-y-2">
                <Label htmlFor="current">Contraseña actual</Label>
                <Input
                  id="current"
                  type="password"
                  placeholder="••••••••"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="next">Nueva contraseña</Label>
                <Input
                  id="next"
                  type="password"
                  placeholder="••••••••"
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {isQrUser && (
                <p className="text-xs text-muted-foreground">
                  ¿Nunca creaste una contraseña?{' '}
                  <Link href="/set-password" className="text-primary underline">
                    Crear contraseña
                  </Link>
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading || next.length < 8}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              {!forcedChange && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground text-xs"
                  onClick={() => router.push('/')}
                >
                  Cancelar
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
