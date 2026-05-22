'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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
      router.push(data.redirect ?? (data.role === 'admin' ? '/admin' : '/predictions'))
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen gradient-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Geometric background pattern */}
      <div className="pattern-geo absolute inset-0" />

      {/* Decorative "26" backdrop */}
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
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿Sin contraseña aún? Escanea el QR que te enviaron
        </p>
      </div>
    </div>
  )
}
