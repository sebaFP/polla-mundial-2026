'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al restablecer')
        return
      }
      setDone(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gradient-gold">Nueva contraseña</h1>
          <p className="text-muted-foreground text-sm">Polla Mundial 2026</p>
        </div>

        <Card className="glass-card border-border">
          {done ? (
            <>
              <CardHeader>
                <CardTitle className="text-xl">¡Contraseña restablecida!</CardTitle>
                <CardDescription>Ya puedes iniciar sesión con tu nueva contraseña.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => router.push('/login')}>
                  Ir al inicio de sesión
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Crear nueva contraseña</CardTitle>
                <CardDescription>Mínimo 8 caracteres</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nueva contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmar contraseña</Label>
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
                  <Button
                    type="submit"
                    className="w-full font-bold"
                    disabled={loading || password.length < 8 || password !== confirm}
                  >
                    {loading ? 'Guardando...' : 'GUARDAR CONTRASEÑA'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
