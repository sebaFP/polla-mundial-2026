'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'

type Props = { initialConfig: Record<string, string> }

type ConfigItem = {
  key: string
  label: string
  description: string
  type: 'points' | 'toggle'
  min?: number
  max?: number
}

const SCORING_ITEMS: ConfigItem[] = [
  { key: 'points_exact_score', label: 'Resultado Exacto', description: 'El marcador final coincide exactamente', type: 'points', min: 0, max: 20 },
  { key: 'points_goal_diff', label: 'Diferencia de Goles', description: 'La diferencia de goles es correcta', type: 'points', min: 0, max: 15 },
  { key: 'points_tendency', label: 'Tendencia (W/D/L)', description: 'Solo acierta quién gana, pierde o empata', type: 'points', min: 0, max: 10 },
]

const GROUP_ITEMS: ConfigItem[] = [
  { key: 'points_group_winner', label: '1° Lugar del Grupo', description: 'Acierta el ganador del grupo', type: 'points', min: 0, max: 20 },
  { key: 'points_group_runner_up', label: '2° Lugar del Grupo', description: 'Acierta el segundo del grupo', type: 'points', min: 0, max: 15 },
]

const SPECIAL_ITEMS: ConfigItem[] = [
  { key: 'points_champion', label: 'Campeón del Mundo', description: 'Acierta el campeón del torneo', type: 'points', min: 0, max: 50 },
  { key: 'points_finalist', label: 'Finalista (perdedor)', description: 'Acierta el finalista que pierde', type: 'points', min: 0, max: 30 },
  { key: 'points_third_place', label: '3° Lugar', description: 'Acierta el ganador del tercer puesto', type: 'points', min: 0, max: 20 },
  { key: 'points_top_scorer', label: 'Goleador del Torneo', description: 'Acierta el máximo goleador', type: 'points', min: 0, max: 30 },
]

const FEATURE_ITEMS: ConfigItem[] = [
  { key: 'feature_group_predictions', label: 'Pronósticos de Grupos', description: 'Permitir predecir clasificados por grupo', type: 'toggle' },
  { key: 'feature_special_predictions', label: 'Predicciones Especiales', description: 'Permitir campeón, finalista, etc.', type: 'toggle' },
  { key: 'feature_top_scorer', label: 'Goleador del Torneo', description: 'Incluir predicción de máximo goleador', type: 'toggle' },
]

const LOCK_ITEMS: ConfigItem[] = [
  { key: 'prediction_lock_minutes', label: 'Minutos de cierre previo', description: 'Minutos antes del partido que se cierran pronósticos', type: 'points', min: 0, max: 120 },
]

function PointsSlider({ item, value, onChange }: { item: ConfigItem; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{item.label}</p>
          <p className="text-xs text-muted-foreground">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-primary font-mono w-8 text-right">{value}</span>
          <span className="text-xs text-muted-foreground">pts</span>
        </div>
      </div>
      <Slider
        min={item.min ?? 0}
        max={item.max ?? 20}
        step={1}
        value={[value]}
        onValueChange={(vals) => onChange((vals as number[])[0])}
        className="cursor-pointer"
      />
    </div>
  )
}

export default function ConfigPanel({ initialConfig }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function update(key: string, value: string | number | boolean) {
    setConfig(prev => ({ ...prev, [key]: String(value) }))
    setDirty(true)
  }

  async function saveConfig() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) { toast.error('Error al guardar'); return }
      setDirty(false)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {dirty && (
        <div className="sticky top-16 z-10 bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-primary font-medium">Hay cambios sin guardar</p>
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Todo'}
          </Button>
        </div>
      )}

      {/* Scoring rules */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">⚽ Puntos por Pronóstico de Partido</CardTitle>
          <CardDescription className="text-xs">
            Se aplican a los 104 partidos del torneo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SCORING_ITEMS.map(item => (
            <PointsSlider
              key={item.key}
              item={item}
              value={parseInt(config[item.key] ?? '0')}
              onChange={v => update(item.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Group predictions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">🏅 Puntos por Clasificados de Grupo</CardTitle>
          <CardDescription className="text-xs">Puntos por predecir el 1° y 2° de cada grupo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {GROUP_ITEMS.map(item => (
            <PointsSlider
              key={item.key}
              item={item}
              value={parseInt(config[item.key] ?? '0')}
              onChange={v => update(item.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Special predictions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">⭐ Puntos por Predicciones Especiales</CardTitle>
          <CardDescription className="text-xs">Predicciones al inicio del torneo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SPECIAL_ITEMS.map(item => (
            <PointsSlider
              key={item.key}
              item={item}
              value={parseInt(config[item.key] ?? '0')}
              onChange={v => update(item.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Lock time */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">⏰ Tiempo de Cierre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {LOCK_ITEMS.map(item => (
            <PointsSlider
              key={item.key}
              item={item}
              value={parseInt(config[item.key] ?? '15')}
              onChange={v => update(item.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Features toggles */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">🔧 Funcionalidades</CardTitle>
          <CardDescription className="text-xs">Activa o desactiva categorías de pronósticos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_ITEMS.map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={config[item.key] === 'true'}
                onCheckedChange={v => update(item.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={saveConfig} disabled={saving || !dirty} className="w-full">
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </Button>
    </div>
  )
}
