'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { CompetitionSelector } from '@/components/competition-selector'
import { COMPETITIONS, type Competition } from '@/lib/competitions'

export default function CreatePollaPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [competition, setCompetition] = useState<Competition>(COMPETITIONS[0])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/pollas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          competitionId:    competition.id,
          competitionCode:  competition.code,
          competitionName:  competition.name,
          competitionEmblem: competition.emblem,
          competitionArea:  competition.area,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear polla')
        return
      }
      toast.success(`¡${data.name} creada!`)
      router.push(`/polla/${data.slug}/admin/participants`)
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
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-gradient-gold">Nueva Polla</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{competition.name}</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Crear Polla</CardTitle>
            <CardDescription>Serás el administrador de esta polla</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Torneo *</Label>
                <CompetitionSelector value={competition} onChange={setCompetition} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="polla-name">Nombre de la polla *</Label>
                <Input
                  id="polla-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Polla del trabajo"
                  required
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="polla-desc">Descripción (opcional)</Label>
                <Textarea
                  id="polla-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Una descripción breve..."
                  rows={3}
                  maxLength={300}
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={loading}>
                {loading ? 'Creando...' : 'CREAR POLLA'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            ← Volver a mis pollas
          </Link>
        </p>
      </div>
    </div>
  )
}
