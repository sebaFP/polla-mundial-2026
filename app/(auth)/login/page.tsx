'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Self-service link flow
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setLinkLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      // Always show success (don't leak whether email exists)
      setLinkSent(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLinkLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al iniciar sesión')
        return
      }
      toast.success(`Bienvenido, ${data.name}`)
      const redirectTo = new URLSearchParams(window.location.search).get('redirect')
      router.push(redirectTo || data.redirect || '/')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    try {
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, message: resetMessage }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al enviar solicitud')
        return
      }
      setResetSent(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="pattern-geo absolute inset-0" />

      <div
        className="absolute right-[-4rem] top-[-3rem] text-[20rem] font-black leading-none select-none pointer-events-none opacity-[0.04]"
        style={{ color: '#2A398D' }}
        aria-hidden
      >
        26
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: '#E61D25' }}>FIFA</span>
            <span className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">·</span>
            <span className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: '#2A398D' }}>WORLD</span>
            <span className="text-xs font-black tracking-[0.3em] uppercase text-muted-foreground">·</span>
            <span className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: '#3CAC3B' }}>CUP</span>
          </div>

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

          <p className="text-muted-foreground text-sm">
            Canadá · Estados Unidos · México
          </p>
        </div>

        {!showReset ? (
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Iniciar sesión</CardTitle>
              <CardDescription>Admin o participante con contraseña</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full font-bold tracking-wide" disabled={loading}>
                  {loading ? 'Ingresando...' : 'INGRESAR'}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                  onClick={() => { setResetEmail(email); setShowReset(true) }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Recuperar contraseña</CardTitle>
              <CardDescription>Elige cómo quieres recuperar tu acceso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Option 1: self-service link */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Recibir link por email</p>
                {linkSent ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Si existe una cuenta con ese email, recibirás un link para restablecer tu contraseña. El link expira en 1 hora.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => { setShowReset(false); setLinkSent(false) }}
                    >
                      Volver al inicio de sesión
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSendLink} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                    <Button
                      type="submit"
                      className="w-full font-bold tracking-wide"
                      disabled={linkLoading || !resetEmail}
                    >
                      {linkLoading ? 'Enviando...' : 'ENVIAR LINK'}
                    </Button>
                  </form>
                )}
              </div>

              {!linkSent && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">o</span>
                    </div>
                  </div>

                  {/* Option 2: request to admin */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Solicitar al administrador</p>
                    {resetSent ? (
                      <p className="text-sm text-muted-foreground">
                        Solicitud enviada. El administrador restablecerá tu contraseña pronto.
                      </p>
                    ) : (
                      <form onSubmit={handleResetRequest} className="space-y-3">
                        <Input
                          type="email"
                          placeholder="tu@email.com"
                          value={resetEmail}
                          onChange={e => setResetEmail(e.target.value)}
                          required
                          autoComplete="email"
                        />
                        <Textarea
                          placeholder="Cuéntale al admin quién eres y por qué necesitas recuperar tu contraseña..."
                          value={resetMessage}
                          onChange={e => setResetMessage(e.target.value)}
                          required
                          minLength={10}
                          rows={3}
                          className="resize-none"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full font-bold tracking-wide"
                          disabled={resetLoading || resetMessage.length < 10}
                        >
                          {resetLoading ? 'Enviando...' : 'ENVIAR SOLICITUD'}
                        </Button>
                      </form>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                onClick={() => { setShowReset(false); setResetSent(false); setLinkSent(false) }}
              >
                Volver al inicio de sesión
              </button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          ¿Sin cuenta?{' '}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Regístrate
          </Link>
          {' '}o escanea el QR que te enviaron
        </p>
      </div>
    </div>
  )
}
