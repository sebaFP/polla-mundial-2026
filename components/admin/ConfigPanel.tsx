'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  { key: 'polla_open', label: 'Polla Abierta', description: 'Cuando está cerrada, los participantes no pueden enviar pronósticos', type: 'toggle' },
  { key: 'feature_group_predictions', label: 'Pronósticos de Grupos', description: 'Permitir predecir clasificados por grupo', type: 'toggle' },
  { key: 'feature_special_predictions', label: 'Predicciones Especiales', description: 'Permitir campeón, finalista, etc.', type: 'toggle' },
  { key: 'feature_top_scorer', label: 'Goleador del Torneo', description: 'Incluir predicción de máximo goleador', type: 'toggle' },
]

const LOCK_ITEMS: ConfigItem[] = [
  { key: 'prediction_lock_minutes', label: 'Minutos de cierre previo', description: 'Minutos antes del partido que se cierran pronósticos', type: 'points', min: 0, max: 120 },
]

const TABS = [
  { id: 'scoring', label: '⚽ Puntuación' },
  { id: 'rules', label: '📋 Reglamento' },
  { id: 'inscription', label: '📝 Inscripción' },
  { id: 'prizes', label: '🏆 Premios' },
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

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-CL')}`
}

export default function ConfigPanel({ initialConfig }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('scoring')
  const [rulesPreview, setRulesPreview] = useState(false)

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

  const fee = parseInt(config.inscription_fee ?? '0') || 0
  const pct1 = parseInt(config.prize_1_pct ?? '60') || 0
  const pct2 = parseInt(config.prize_2_pct ?? '30') || 0
  const pct3 = parseInt(config.prize_3_pct ?? '10') || 0
  const pctTotal = pct1 + pct2 + pct3

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

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Puntuación */}
      {activeTab === 'scoring' && (
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">⚽ Puntos por Pronóstico de Partido</CardTitle>
              <CardDescription className="text-xs">Se aplican a los 104 partidos del torneo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {SCORING_ITEMS.map(item => (
                <PointsSlider key={item.key} item={item} value={parseInt(config[item.key] ?? '0')} onChange={v => update(item.key, v)} />
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">🏅 Puntos por Clasificados de Grupo</CardTitle>
              <CardDescription className="text-xs">Puntos por predecir el 1° y 2° de cada grupo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {GROUP_ITEMS.map(item => (
                <PointsSlider key={item.key} item={item} value={parseInt(config[item.key] ?? '0')} onChange={v => update(item.key, v)} />
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">⭐ Puntos por Predicciones Especiales</CardTitle>
              <CardDescription className="text-xs">Predicciones al inicio del torneo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {SPECIAL_ITEMS.map(item => (
                <PointsSlider key={item.key} item={item} value={parseInt(config[item.key] ?? '0')} onChange={v => update(item.key, v)} />
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">⏰ Tiempo de Cierre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {LOCK_ITEMS.map(item => (
                <PointsSlider key={item.key} item={item} value={parseInt(config[item.key] ?? '15')} onChange={v => update(item.key, v)} />
              ))}
            </CardContent>
          </Card>

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
                  <Switch checked={config[item.key] === 'true'} onCheckedChange={v => update(item.key, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Reglamento */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">📋 Reglamento del Torneo</CardTitle>
              <CardDescription className="text-xs">
                Texto visible para todos los participantes en /reglamento. Soporta Markdown.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant={!rulesPreview ? 'default' : 'outline'} onClick={() => setRulesPreview(false)}>
                  Editar
                </Button>
                <Button size="sm" variant={rulesPreview ? 'default' : 'outline'} onClick={() => setRulesPreview(true)}>
                  Vista previa
                </Button>
              </div>

              {!rulesPreview ? (
                <Textarea
                  placeholder={`# Reglamento Polla Mundial 2026\n\n## Cómo participar\n- ...\n\n## Puntuación\n- ...`}
                  value={config.rules_text ?? ''}
                  onChange={e => update('rules_text', e.target.value)}
                  className="min-h-80 font-mono text-sm"
                />
              ) : (
                <div className="min-h-80 p-4 rounded-md border border-border bg-muted/20">
                  {config.rules_text ? (
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{config.rules_text}</pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">Sin contenido aún</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Inscripción */}
      {activeTab === 'inscription' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">📝 Configuración de Inscripción</CardTitle>
              <CardDescription className="text-xs">
                Define si hay requisitos de inscripción y qué debe cumplir cada participante
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Habilitar Inscripción</Label>
                  <p className="text-xs text-muted-foreground">Los participantes deben confirmar su inscripción y el admin debe aprobarla</p>
                </div>
                <Switch
                  checked={config.inscription_enabled === 'true'}
                  onCheckedChange={v => update('inscription_enabled', v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cuota de Inscripción</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.inscription_fee ?? '0'}
                    onChange={e => update('inscription_fee', e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">0 = gratuito</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moneda / Unidad</Label>
                  <Input
                    value={config.inscription_currency ?? 'CLP'}
                    onChange={e => update('inscription_currency', e.target.value)}
                    placeholder="CLP"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">Ej: CLP, USD, €, fichas</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Requisitos de Inscripción</Label>
                <Textarea
                  placeholder={`- Realizar transferencia de $10.000 a cuenta ...\n- Indicar nombre completo en la glosa\n- Enviar comprobante por WhatsApp`}
                  value={config.inscription_requirements ?? ''}
                  onChange={e => update('inscription_requirements', e.target.value)}
                  className="min-h-32 text-sm"
                />
                <p className="text-xs text-muted-foreground">Visible para los participantes en /inscripcion</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Premios */}
      {activeTab === 'prizes' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">🏆 Distribución de Premios</CardTitle>
              <CardDescription className="text-xs">
                El pozo se calcula automáticamente: participantes aprobados × cuota de inscripción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Mostrar Pozo de Premios</Label>
                  <p className="text-xs text-muted-foreground">Visible en la tabla de posiciones</p>
                </div>
                <Switch
                  checked={config.prize_pool_enabled === 'true'}
                  onCheckedChange={v => update('prize_pool_enabled', v)}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">🥇 1° Lugar</Label>
                    <span className="text-primary font-bold font-mono">{pct1}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[pct1]} onValueChange={v => update('prize_1_pct', (v as number[])[0])} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">🥈 2° Lugar</Label>
                    <span className="text-primary font-bold font-mono">{pct2}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[pct2]} onValueChange={v => update('prize_2_pct', (v as number[])[0])} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">🥉 3° Lugar</Label>
                    <span className="text-primary font-bold font-mono">{pct3}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[pct3]} onValueChange={v => update('prize_3_pct', (v as number[])[0])} />
                </div>

                {pctTotal !== 100 && (
                  <p className="text-xs text-destructive font-medium">
                    Los porcentajes suman {pctTotal}% — deben sumar 100%
                  </p>
                )}
              </div>

              {/* Preview */}
              {fee > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vista previa (ejemplo con 10 aprobados)</p>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gradient-gold">
                      {formatAmount(fee * 10, config.inscription_currency ?? 'CLP')}
                    </p>
                    <p className="text-xs text-muted-foreground">Pozo estimado</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-amber-400">{formatAmount(Math.round(fee * 10 * pct1 / 100), config.inscription_currency ?? 'CLP')}</p>
                      <p className="text-xs text-muted-foreground">🥇 1°</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-300">{formatAmount(Math.round(fee * 10 * pct2 / 100), config.inscription_currency ?? 'CLP')}</p>
                      <p className="text-xs text-muted-foreground">🥈 2°</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-400">{formatAmount(Math.round(fee * 10 * pct3 / 100), config.inscription_currency ?? 'CLP')}</p>
                      <p className="text-xs text-muted-foreground">🥉 3°</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Button onClick={saveConfig} disabled={saving || !dirty} className="w-full">
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </Button>
    </div>
  )
}
