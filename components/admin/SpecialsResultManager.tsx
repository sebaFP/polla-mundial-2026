'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { type Config, getRangeOptions } from '@/lib/scoring'

type Prediction = {
  id: string
  userId: string
  type: string
  teamName: string | null
  playerName: string | null
  points: number | null
  userName: string | null
}

type Props = {
  pollaId: string
  config: Config
  predictions: Prediction[]
}

type ItemDef = {
  type: string
  label: string
  kind: 'team' | 'player' | 'range'
  featureKey?: string
  optionsKey?: string
}

const SPECIAL_ITEMS: ItemDef[] = [
  { type: 'champion', label: 'Campeón del Mundo', kind: 'team' },
  { type: 'finalist', label: 'Finalista (perdedor)', kind: 'team' },
  { type: 'third', label: '3° Lugar', kind: 'team' },
]

const BONUS_ITEMS: ItemDef[] = [
  { type: 'top_scorer', label: 'Goleador del Torneo', kind: 'player', featureKey: 'feature_top_scorer' },
  { type: 'best_goalkeeper', label: 'Mejor Arquero', kind: 'player', featureKey: 'feature_best_goalkeeper' },
  { type: 'best_player', label: 'Mejor Jugador (Balón de Oro)', kind: 'player', featureKey: 'feature_best_player' },
  { type: 'bonus_most_goals_team', label: 'Selección más goleadora', kind: 'team', featureKey: 'feature_bonus_most_goals_team' },
  { type: 'bonus_most_conceded_team', label: 'Selección más goleada', kind: 'team', featureKey: 'feature_bonus_most_conceded_team' },
  { type: 'bonus_red_cards_range', label: 'Tarjetas rojas (rango)', kind: 'range', featureKey: 'feature_bonus_red_cards_range', optionsKey: 'options_bonus_red_cards_range' },
  { type: 'bonus_goals_range', label: 'Total de goles (rango)', kind: 'range', featureKey: 'feature_bonus_goals_range', optionsKey: 'options_bonus_goals_range' },
  { type: 'bonus_penalties_range', label: 'Penales (rango)', kind: 'range', featureKey: 'feature_bonus_penalties_range', optionsKey: 'options_bonus_penalties_range' },
  { type: 'bonus_group_top_scorer', label: 'Goleador fase de grupos', kind: 'range', featureKey: 'feature_bonus_group_top_scorer', optionsKey: 'options_bonus_group_top_scorer' },
]

const KIND_BADGE: Record<string, string> = { team: '🏳️ Selección', player: '👤 Jugador', range: '📊 Rango' }

function ItemCard({
  item,
  pollaId,
  config,
  preds,
}: {
  item: ItemDef
  pollaId: string
  config: Config
  preds: Prediction[]
}) {
  const configKey = `result_${item.type}`
  const [value, setValue] = useState<string>(config[configKey] ?? '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [predPoints, setPredPoints] = useState<Record<string, number | null>>(
    Object.fromEntries(preds.map(p => [p.id, p.points]))
  )
  const [toggling, setToggling] = useState<string | null>(null)

  const storedResult = config[configKey]
  const rangeOptions = item.kind === 'range' && item.optionsKey
    ? getRangeOptions(config, item.type)
    : []

  async function handleSave() {
    if (!value.trim()) { toast.error('Ingresa el resultado correcto'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/special-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, value: value.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return }
      toast.success(`Resultado guardado — ${data.updated} pronósticos recalculados`)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(pred: Prediction, correct: boolean) {
    setToggling(pred.id)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/special-results/${pred.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correct }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setPredPoints(prev => ({ ...prev, [pred.id]: data.points }))
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{item.label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium leading-none">
          {KIND_BADGE[item.kind]}
        </span>
        {storedResult && (
          <span className="ml-auto text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded px-2 py-0.5">
            ✓ {storedResult}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {item.kind === 'range' ? (
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">— Selecciona resultado —</option>
            {rangeOptions.map(o => (
              <option key={o.label} value={o.label}>{o.label} ({o.points} pts)</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={item.kind === 'player' ? 'Nombre del jugador' : 'Nombre de la selección'}
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {preds.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(x => !x)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? '▲' : '▼'} {preds.length} respuesta{preds.length !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1">
              {preds.map(pred => {
                const answer = pred.teamName ?? pred.playerName ?? '—'
                const pts = predPoints[pred.id]
                const isCorrect = pts !== null && pts !== undefined && pts > 0
                return (
                  <div key={pred.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="flex-1 text-muted-foreground">{pred.userName ?? 'Usuario'}</span>
                    <span className="font-medium">{answer}</span>
                    <span className={`w-14 text-center font-medium ${isCorrect ? 'text-emerald-400' : pts !== null ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                      {pts !== null && pts !== undefined ? `${pts} pts` : '—'}
                    </span>
                    {item.kind === 'player' && (
                      <div className="flex gap-1">
                        <button
                          disabled={toggling === pred.id}
                          onClick={() => handleToggle(pred, true)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-emerald-900 hover:text-emerald-300'}`}
                        >
                          ✓
                        </button>
                        <button
                          disabled={toggling === pred.id}
                          onClick={() => handleToggle(pred, false)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${!isCorrect && pts !== null ? 'bg-red-800 text-white' : 'bg-muted text-muted-foreground hover:bg-red-900 hover:text-red-300'}`}
                        >
                          ✗
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SpecialsResultManager({ pollaId, config, predictions }: Props) {
  const predsByType = predictions.reduce<Record<string, Prediction[]>>((acc, p) => {
    ;(acc[p.type] ??= []).push(p)
    return acc
  }, {})

  const specialsEnabled = config.feature_special_predictions === 'true'
  const bonusEnabled = config.feature_bonus_predictions === 'true'

  const enabledBonus = BONUS_ITEMS.filter(i => !i.featureKey || config[i.featureKey] === 'true')

  if (!specialsEnabled && !bonusEnabled) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-muted-foreground text-sm">
        Las predicciones especiales y bonus no están habilitadas en la configuración de esta polla.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {specialsEnabled && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Especiales del Torneo</h2>
          {SPECIAL_ITEMS.map(item => (
            <ItemCard
              key={item.type}
              item={item}
              pollaId={pollaId}
              config={config}
              preds={predsByType[item.type] ?? []}
            />
          ))}
        </section>
      )}

      {bonusEnabled && enabledBonus.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Premios y Bonus</h2>
          {enabledBonus.map(item => (
            <ItemCard
              key={item.type}
              item={item}
              pollaId={pollaId}
              config={config}
              preds={predsByType[item.type] ?? []}
            />
          ))}
        </section>
      )}
    </div>
  )
}
