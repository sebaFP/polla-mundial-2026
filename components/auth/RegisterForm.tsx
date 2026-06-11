'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function RegisterForm({ token }: { token: string }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/invite/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al registrarse')
        return
      }
      // Hard navigate so the new session cookies are picked up
      window.location.href = data.slug ? `/polla/${data.slug}/predictions` : '/'
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Tu nombre</Label>
            <Input
              id="reg-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="¿Cómo te llaman?"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !name.trim()} className="w-full font-bold">
            {loading ? 'Registrando…' : 'Unirse a la polla'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
