'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al registrarse')
        return
      }
      toast.success(`Bienvenido, ${data.name}`)
      router.push(data.redirect ?? '/')
    } catch {
      toast.error('Error de conexión')
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

        <Card className="glass-card" style={{ borderColor: 'oklch(0.32 0.13 262 / 0.3)' }}>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Crear cuenta</CardTitle>
            <CardDescription>Regístrate para crear o unirte a una polla</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
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
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full font-bold tracking-wide" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'REGISTRARSE'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
