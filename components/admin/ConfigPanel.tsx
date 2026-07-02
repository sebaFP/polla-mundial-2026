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
import { type RangeOption, RANGE_OPTION_DEFAULTS } from '@/lib/scoring'

type Props = { initialConfig: Record<string, string>; pollaId?: string }

type ConfigItem = {
  key: string
  label: string
  description: string
  type: 'points' | 'toggle'
  min?: number
  max?: number
  unit?: string
}

const SCORING_ITEMS: ConfigItem[] = [
  { key: 'points_exact_score', label: 'Resultado Exacto', description: 'El marcador final coincide exactamente', type: 'points', min: 0, max: 20 },
  { key: 'points_goal_diff', label: 'Diferencia de Goles', description: 'La diferencia de goles es correcta', type: 'points', min: 0, max: 15 },
  { key: 'points_tendency', label: 'Tendencia (W/D/L)', description: 'Solo acierta quién gana, pierde o empata', type: 'points', min: 0, max: 10 },
]

const GROUP_ITEMS: ConfigItem[] = [
  { key: 'points_group_winner', label: '1° Lugar del Grupo', description: 'Acierta el ganador del grupo', type: 'points', min: 0, max: 20 },
  { key: 'points_group_runner_up', label: '2° Lugar del Grupo', description: 'Acierta el segundo del grupo', type: 'points', min: 0, max: 15 },
  { key: 'points_group_third_place', label: '3° Lugar del Grupo', description: 'Acierta el tercero del grupo', type: 'points', min: 0, max: 10 },
]

const BONUS_TYPE_LABELS: Record<string, string> = { team: '🏳️ Selección', player: '👤 Jugador', range: '📊 Rango' }
type BonusConfigItem = {
  featureKey: string; pointsKey: string; label: string; description: string; max: number
  kind: 'team' | 'player' | 'range'
  optionsKey?: string
}
const BONUS_CONFIG_ITEMS: BonusConfigItem[] = [
  { featureKey: 'feature_top_scorer', pointsKey: 'points_top_scorer', label: 'Goleador del Torneo', description: '¿Quién será el máximo goleador del torneo?', max: 30, kind: 'player' },
  { featureKey: 'feature_best_goalkeeper', pointsKey: 'points_best_goalkeeper', label: 'Mejor Arquero', description: '¿Quién será el mejor portero del torneo?', max: 30, kind: 'player' },
  { featureKey: 'feature_best_player', pointsKey: 'points_best_player', label: 'Mejor Jugador (Balón de Oro)', description: '¿Quién será el jugador más destacado del torneo?', max: 30, kind: 'player' },
  { featureKey: 'feature_bonus_most_goals_team', pointsKey: 'points_bonus_most_goals_team', label: 'Selección más goleadora', description: '¿Qué selección anota más goles en fase de grupos?', max: 20, kind: 'team' },
  { featureKey: 'feature_bonus_most_conceded_team', pointsKey: 'points_bonus_most_conceded_team', label: 'Selección más goleada', description: '¿Qué selección recibe más goles en fase de grupos?', max: 15, kind: 'team' },
  { featureKey: 'feature_bonus_red_cards_range', pointsKey: 'points_bonus_red_cards_range', label: 'Tarjetas rojas (rango)', description: '¿Cuántas tarjetas rojas habrá en fase de grupos?', max: 10, kind: 'range', optionsKey: 'options_bonus_red_cards_range' },
  { featureKey: 'feature_bonus_goals_range', pointsKey: 'points_bonus_goals_range', label: 'Total de goles (rango)', description: '¿Cuántos goles se anotarán en fase de grupos?', max: 10, kind: 'range', optionsKey: 'options_bonus_goals_range' },
  { featureKey: 'feature_bonus_penalties_range', pointsKey: 'points_bonus_penalties_range', label: 'Penales (rango)', description: '¿Cuántos penales se cobrarán en fase de grupos?', max: 10, kind: 'range', optionsKey: 'options_bonus_penalties_range' },
  { featureKey: 'feature_bonus_group_top_scorer', pointsKey: 'points_bonus_group_top_scorer', label: 'Goleador fase de grupos', description: '¿Quién anota más goles en fase de grupos?', max: 20, kind: 'range', optionsKey: 'options_bonus_group_top_scorer' },
]

const SPECIAL_ITEMS: ConfigItem[] = [
  { key: 'points_champion', label: 'Campeón del Mundo', description: 'Acierta el campeón del torneo', type: 'points', min: 0, max: 50 },
  { key: 'points_finalist', label: 'Finalista (perdedor)', description: 'Acierta el finalista que pierde', type: 'points', min: 0, max: 30 },
  { key: 'points_third_place', label: '3° Lugar', description: 'Acierta el ganador del tercer puesto', type: 'points', min: 0, max: 20 },
]

const FEATURE_ITEMS: ConfigItem[] = [
  { key: 'polla_open', label: 'Polla Abierta', description: 'Cuando está cerrada, los participantes no pueden enviar pronósticos', type: 'toggle' },
  { key: 'feature_group_predictions', label: 'Pronósticos de Grupos', description: 'Permitir predecir clasificados por grupo', type: 'toggle' },
  { key: 'feature_special_predictions', label: 'Predicciones Especiales', description: 'Permitir campeón, finalista, etc.', type: 'toggle' },
  { key: 'feature_bonus_predictions', label: 'Preguntas Bonus & Premios Individuales', description: 'Goleador, mejor arquero, mejor jugador y preguntas de la planilla del Mundial', type: 'toggle' },
  { key: 'feature_custom_questions', label: 'Preguntas Personalizadas', description: 'Preguntas creadas por el admin de la polla (gestionar en Configuración → Preguntas)', type: 'toggle' },
]

const LOCK_ITEMS: ConfigItem[] = [
  { key: 'prediction_lock_minutes', label: 'Minutos de cierre previo', description: 'Minutos antes del partido que se cierran pronósticos', type: 'points', min: 0, max: 120, unit: 'mins' },
]

const TABS = [
  { id: 'scoring', label: '⚽ Puntuación' },
  { id: 'rules', label: '📋 Reglamento' },
  { id: 'inscription', label: '📝 Inscripción' },
  { id: 'prizes', label: '🏆 Premios' },
]

function OptionsEditor({
  optionsKey,
  config,
  update,
}: {
  optionsKey: string
  config: Record<string, string>
  update: (key: string, value: string | number | boolean) => void
}) {
  function getOptions(): RangeOption[] {
    const stored = config[optionsKey]
    if (stored) {
      try { return JSON.parse(stored) as RangeOption[] } catch { /* */ }
    }
    return RANGE_OPTION_DEFAULTS[optionsKey] ?? []
  }

  const options = getOptions()

  function setOptions(next: RangeOption[]) {
    update(optionsKey, JSON.stringify(next))
  }

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs text-muted-foreground font-medium">Opciones de respuesta:</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={opt.label}
            onChange={e => {
              const next = options.map((o, j) => j === i ? { ...o, label: e.target.value } : o)
              setOptions(next)
            }}
            placeholder="Etiqueta..."
            className="flex-1 px-2 py-1 text-xs rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="number"
            value={opt.points}
            min={0}
            max={99}
            onChange={e => {
              const next = options.map((o, j) => j === i ? { ...o, points: parseInt(e.target.value) || 0 } : o)
              setOptions(next)
            }}
            className="w-14 px-2 py-1 text-xs rounded-md bg-input border border-border text-center text-foreground"
          />
          <span className="text-xs text-muted-foreground shrink-0">pts</span>
          <button
            onClick={() => setOptions(options.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive transition-colors text-sm leading-none shrink-0"
          >✕</button>
        </div>
      ))}
      <button
        onClick={() => setOptions([...options, { label: '', points: 5 }])}
        className="text-xs text-primary hover:text-primary/80 transition-colors"
      >+ Agregar opción</button>
    </div>
  )
}

function PointsSlider({ item, value, onChange }: { item: ConfigItem; value: number; onChange: (v: number) => void }) {
  const unit = item.unit ?? 'pts'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{item.label}</p>
          <p className="text-xs text-muted-foreground">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-primary font-mono w-8 text-right">{value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider
        min={item.min ?? 0}
        max={item.max ?? 20}
        step={1}
        value={[value]}
        onValueChange={(vals) => {
          const v = Array.isArray(vals) ? vals[0] : vals
          if (typeof v === 'number' && !isNaN(v)) {
            onChange(v)
          }
        }}
        className="cursor-pointer"
      />
    </div>
  )
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-CL')}`
}

export default function ConfigPanel({ initialConfig, pollaId }: Props) {
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
      const endpoint = pollaId ? `/api/pollas/${pollaId}/config` : '/api/admin/config'
      const res = await fetch(endpoint, {
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

  const adminFeeEnabled = config.admin_fee_enabled === 'true'
  const adminFeeType = config.admin_fee_type ?? 'percentage'
  const adminFeeValue = parseFloat(config.admin_fee_value ?? '0') || 0

  function calcAdminFee(gross: number) {
    if (!adminFeeEnabled || adminFeeValue <= 0) return 0
    if (adminFeeType === 'percentage') return Math.round(gross * adminFeeValue / 100)
    return adminFeeValue
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

          {config.feature_bonus_predictions === 'true' && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">🎯 Preguntas Bonus & Premios Individuales</CardTitle>
                <CardDescription className="text-xs">Activa cada pregunta y configura sus puntos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {BONUS_CONFIG_ITEMS.map(item => (
                  <div key={item.featureKey} className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{item.label}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium leading-none">{BONUS_TYPE_LABELS[item.kind]}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch checked={config[item.featureKey] === 'true'} onCheckedChange={v => update(item.featureKey, v)} />
                    </div>
                    {config[item.featureKey] === 'true' && (
                      item.kind === 'range' && item.optionsKey ? (
                        <OptionsEditor optionsKey={item.optionsKey} config={config} update={update} />
                      ) : (
                        <PointsSlider
                          item={{ key: item.pointsKey, label: 'Puntos si acierta', description: '', type: 'points', min: 0, max: item.max }}
                          value={parseInt(config[item.pointsKey] ?? '0')}
                          onChange={v => update(item.pointsKey, v)}
                        />
                      )
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">⏰ Tiempo de Cierre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {LOCK_ITEMS.map(item => (
                <PointsSlider key={item.key} item={item} value={parseInt(config[item.key] ?? '15')} onChange={v => update(item.key, v)} />
              ))}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Modo de bloqueo</p>
                  <p className="text-xs text-muted-foreground">Cuándo se cierran los pronósticos de partido</p>
                </div>
                <div className="space-y-2 pt-1">
                  {[
                    { value: 'match', label: 'Partido a partido', desc: 'Cada partido se cierra individualmente según su hora de inicio' },
                    { value: 'phase', label: 'Por fase', desc: 'Todos los partidos de una fase se cierran cuando inicia el primero (ej. toda la fase de grupos, toda la R32, etc.)' },
                    { value: 'total', label: 'Total', desc: 'Todos los pronósticos se cierran cuando inicia el primer partido del torneo' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        (config.prediction_lock_mode ?? 'match') === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="prediction_lock_mode"
                        value={opt.value}
                        checked={(config.prediction_lock_mode ?? 'match') === opt.value}
                        onChange={() => update('prediction_lock_mode', opt.value)}
                        className="mt-0.5 accent-primary shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">🏆 Eliminación Directa</CardTitle>
              <CardDescription className="text-xs">Controla cuándo se abren los pronósticos de cada ronda</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { value: 'api', label: 'Automático (API)', desc: 'Se abren cuando la API confirma los equipos de cada cruce' },
                  { value: 'sequential', label: 'Nivel por nivel', desc: 'Cada ronda se abre solo cuando todos los partidos de la ronda anterior finalizan' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      (config.knockout_prediction_mode ?? 'api') === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="knockout_prediction_mode"
                      value={opt.value}
                      checked={(config.knockout_prediction_mode ?? 'api') === opt.value}
                      onChange={() => update('knockout_prediction_mode', opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">⚽ Empates definidos por penales</CardTitle>
              <CardDescription className="text-xs">Cómo puntuar un cruce que termina empatado y se define por penales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { value: 'regular_time', label: 'Resultado en el tiempo', desc: 'El empate cuenta como empate para todos, sin importar quién ganó por penales' },
                  { value: 'final_result', label: 'Resultado final (con penales)', desc: 'Si predijiste el ganador por penales (no el empate), igual recibís los puntos de tendencia' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      (config.knockout_draw_scoring_mode ?? 'regular_time') === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="knockout_draw_scoring_mode"
                      value={opt.value}
                      checked={(config.knockout_draw_scoring_mode ?? 'regular_time') === opt.value}
                      onChange={() => update('knockout_draw_scoring_mode', opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">🌐 Visibilidad</CardTitle>
              <CardDescription className="text-xs">Controla quién puede ver la tabla de posiciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update('polla_visibility', 'private')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${config.polla_visibility !== 'public' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <p className="text-sm font-medium">🔒 Privada</p>
                  <p className="text-xs mt-0.5 opacity-80">Solo miembros pueden ver</p>
                </button>
                <button
                  type="button"
                  onClick={() => update('polla_visibility', 'public')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${config.polla_visibility === 'public' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <p className="text-sm font-medium">🌍 Pública</p>
                  <p className="text-xs mt-0.5 opacity-80">Tabla visible sin iniciar sesión</p>
                </button>
              </div>
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
          {/* Admin fee */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">💼 Comisión del Organizador</CardTitle>
              <CardDescription className="text-xs">
                Monto que queda para los administradores antes de distribuir el pozo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Habilitar Comisión</Label>
                  <p className="text-xs text-muted-foreground">Descuenta del total recaudado antes de calcular premios</p>
                </div>
                <Switch
                  checked={adminFeeEnabled}
                  onCheckedChange={v => update('admin_fee_enabled', v)}
                />
              </div>

              {adminFeeEnabled && (
                <div className="space-y-4 pt-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => update('admin_fee_type', 'percentage')}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-md border transition-colors',
                        adminFeeType === 'percentage'
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      Porcentaje (%)
                    </button>
                    <button
                      onClick={() => update('admin_fee_type', 'amount')}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-md border transition-colors',
                        adminFeeType === 'amount'
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      Monto fijo
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {adminFeeType === 'percentage' ? '% del total recaudado' : `Monto fijo (${config.inscription_currency ?? 'CLP'})`}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={adminFeeType === 'percentage' ? 100 : undefined}
                        step={adminFeeType === 'percentage' ? 1 : 100}
                        value={config.admin_fee_value ?? '0'}
                        onChange={e => update('admin_fee_value', e.target.value)}
                        className="max-w-36"
                      />
                      <span className="text-sm text-muted-foreground">
                        {adminFeeType === 'percentage' ? '%' : config.inscription_currency ?? 'CLP'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {adminFeeType === 'percentage'
                        ? 'Se descuenta del total recaudado. El resto va al pozo de premios.'
                        : 'Monto fijo total para los administradores. El resto va al pozo de premios.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prize distribution */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">🏆 Distribución de Premios</CardTitle>
              <CardDescription className="text-xs">
                {adminFeeEnabled && adminFeeValue > 0
                  ? 'Los porcentajes se aplican al pozo neto (después de descontar la comisión)'
                  : 'El pozo se calcula automáticamente: participantes aprobados × cuota de inscripción'}
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
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[pct1]}
                    onValueChange={vals => {
                      const v = Array.isArray(vals) ? vals[0] : vals
                      if (typeof v === 'number' && !isNaN(v)) {
                        update('prize_1_pct', v)
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">🥈 2° Lugar</Label>
                    <span className="text-primary font-bold font-mono">{pct2}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[pct2]}
                    onValueChange={vals => {
                      const v = Array.isArray(vals) ? vals[0] : vals
                      if (typeof v === 'number' && !isNaN(v)) {
                        update('prize_2_pct', v)
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">🥉 3° Lugar</Label>
                    <span className="text-primary font-bold font-mono">{pct3}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[pct3]}
                    onValueChange={vals => {
                      const v = Array.isArray(vals) ? vals[0] : vals
                      if (typeof v === 'number' && !isNaN(v)) {
                        update('prize_3_pct', v)
                      }
                    }}
                  />
                </div>

                {pctTotal !== 100 && (
                  <p className="text-xs text-destructive font-medium">
                    Los porcentajes suman {pctTotal}% — deben sumar 100%
                  </p>
                )}
              </div>

              {/* Preview */}
              {fee > 0 && (() => {
                const gross = fee * 10
                const adminCut = calcAdminFee(gross)
                const netPool = Math.max(0, gross - adminCut)
                const currency = config.inscription_currency ?? 'CLP'
                return (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vista previa (ejemplo con 10 aprobados)</p>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Total recaudado</span>
                        <span className="text-sm font-semibold font-mono">{formatAmount(gross, currency)}</span>
                      </div>
                      {adminFeeEnabled && adminCut > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            Comisión organizador ({adminFeeType === 'percentage' ? `${adminFeeValue}%` : 'fija'})
                          </span>
                          <span className="text-sm font-semibold font-mono text-muted-foreground">− {formatAmount(adminCut, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-border pt-1.5">
                        <span className="text-xs font-medium">Pozo neto</span>
                        <span className="text-xl font-bold text-gradient-gold">{formatAmount(netPool, currency)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div>
                        <p className="text-lg font-bold text-amber-400">{formatAmount(Math.round(netPool * pct1 / 100), currency)}</p>
                        <p className="text-xs text-muted-foreground">🥇 1°</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-300">{formatAmount(Math.round(netPool * pct2 / 100), currency)}</p>
                        <p className="text-xs text-muted-foreground">🥈 2°</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-400">{formatAmount(Math.round(netPool * pct3 / 100), currency)}</p>
                        <p className="text-xs text-muted-foreground">🥉 3°</p>
                      </div>
                    </div>
                  </div>
                )
              })()}
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
