'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type Props = {
  token: string
  invitedName: string
  mode: 'auto-login' | 'reassign'
  currentUserName?: string
}

export default function JoinClient({ token, invitedName, mode, currentUserName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnter() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/join/${token}/login`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al ingresar'); return }
      router.push(data.slug ? `/polla/${data.slug}/predictions` : '/')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleReassign() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/join/${token}/reassign`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al reasignar'); return }
      router.push(data.slug ? `/polla/${data.slug}/predictions` : '/')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="pattern-geo absolute inset-0" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-black tracking-tight leading-none">
            <span className="text-gradient-fifa">POLLA</span>
            <br />
            <span className="text-gradient-gold">MUNDIAL</span>
          </h1>
          <div className="flex items-center gap-3 justify-center">
            <div className="fifa-stripe flex-1 max-w-16" />
            <span className="text-2xl font-black text-foreground/30 tracking-widest">2026</span>
            <div className="fifa-stripe flex-1 max-w-16" />
          </div>
        </div>

        {mode === 'auto-login' ? (
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Bienvenido</CardTitle>
              <CardDescription>
                Vas a ingresar como <span className="font-semibold text-foreground">{invitedName}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full font-bold tracking-wide" onClick={handleEnter} disabled={loading}>
                {loading ? 'Ingresando...' : `Entrar como ${invitedName}`}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => router.push(`/login?redirect=/join/${token}`)}
                disabled={loading}
              >
                Ya tengo otra cuenta — Iniciar sesión
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Vincular perfil</CardTitle>
              <CardDescription>
                Estás ingresando como <span className="font-semibold text-foreground">{currentUserName}</span>.
                Este enlace pertenece al perfil de <span className="font-semibold text-foreground">{invitedName}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ¿Quieres vincular el perfil de <strong>{invitedName}</strong> a tu cuenta?
                Esto moverá todas sus predicciones y membresías.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full font-bold tracking-wide" onClick={handleReassign} disabled={loading}>
                {loading ? 'Vinculando...' : 'Confirmar vinculación'}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => router.push('/')}
                disabled={loading}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
