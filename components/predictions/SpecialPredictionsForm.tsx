'use client'

import { useState } from 'react'
import { SpecialPrediction } from '@/lib/db/schema'
import { getFlag } from '@/lib/teams'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getConfigValue, getRangeOptions } from '@/lib/scoring'

type Props = {
  teams: string[]
  initialSpecials: SpecialPrediction[]
  config: Record<string, string>
  isLocked: boolean
  pollaId: string
}

const TEAM_TYPES = [
  { type: 'champion', label: '🏆 Campeón', configKey: 'points_champion', description: 'Equipo que ganará el Mundial' },
  { type: 'finalist', label: '🥈 Finalista', configKey: 'points_finalist', description: 'Equipo que llega a la final y pierde' },
  { type: 'third', label: '🥉 Tercer Lugar', configKey: 'points_third_place', description: 'Equipo que gana el partido por el 3° lugar' },
]

type BonusType =
  | { type: string; label: string; description: string; configKey: string; featureKey: string; kind: 'team' }
  | { type: string; label: string; description: string; configKey: string; featureKey: string; kind: 'range' }
  | { type: string; label: string; description: string; configKey: string; featureKey: string; kind: 'player' }

const BONUS_TYPES: BonusType[] = [
  { type: 'top_scorer', label: '⚽ Goleador del Torneo', description: 'Máximo goleador del torneo', configKey: 'points_top_scorer', featureKey: 'feature_top_scorer', kind: 'player' },
  { type: 'best_goalkeeper', label: '🧤 Mejor Arquero', description: 'Mejor portero del torneo', configKey: 'points_best_goalkeeper', featureKey: 'feature_best_goalkeeper', kind: 'player' },
  { type: 'best_player', label: '⭐ Mejor Jugador', description: 'Jugador más destacado del torneo (Balón de Oro)', configKey: 'points_best_player', featureKey: 'feature_best_player', kind: 'player' },
  { type: 'bonus_most_goals_team', label: '⚽ Selección más goleadora', description: '¿Qué selección anotará más goles en la fase de grupos?', configKey: 'points_bonus_most_goals_team', featureKey: 'feature_bonus_most_goals_team', kind: 'team' },
  { type: 'bonus_most_conceded_team', label: '🥅 Selección más goleada', description: '¿Qué selección recibirá más goles en la fase de grupos?', configKey: 'points_bonus_most_conceded_team', featureKey: 'feature_bonus_most_conceded_team', kind: 'team' },
  { type: 'bonus_red_cards_range', label: '🟥 Tarjetas rojas en grupos', description: '¿Cuántas tarjetas rojas habrá en la fase de grupos?', configKey: 'points_bonus_red_cards_range', featureKey: 'feature_bonus_red_cards_range', kind: 'range' },
  { type: 'bonus_goals_range', label: '🎯 Total de goles en grupos', description: '¿Cuántos goles se anotarán en la fase de grupos?', configKey: 'points_bonus_goals_range', featureKey: 'feature_bonus_goals_range', kind: 'range' },
  { type: 'bonus_penalties_range', label: '⚡ Penales en grupos', description: '¿Cuántos penales se cobrarán en la fase de grupos?', configKey: 'points_bonus_penalties_range', featureKey: 'feature_bonus_penalties_range', kind: 'range' },
  { type: 'bonus_group_top_scorer', label: '👟 Goleador de fase de grupos', description: '¿Quién anotará más goles en la fase de grupos?', configKey: 'points_bonus_group_top_scorer', featureKey: 'feature_bonus_group_top_scorer', kind: 'range' },
]

function normChoice(s: string) {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()
}

function getStoredValue(s: SpecialPrediction, bonusType: BonusType): string {
  if (bonusType.kind === 'team') return s.teamName ?? ''
  return s.playerName ?? ''
}

export default function SpecialPredictionsForm({ teams, initialSpecials, config, isLocked, pollaId }: Props) {
  const [teamPreds, setTeamPreds] = useState<Record<string, { team: string; saved: boolean; points?: number | null }>>(() => {
    const map: Record<string, { team: string; saved: boolean; points?: number | null }> = {}
    for (const s of initialSpecials) {
      if (TEAM_TYPES.find(t => t.type === s.type) && s.teamName) {
        map[s.type] = { team: s.teamName, saved: true, points: s.points }
      }
    }
    return map
  })

  const [bonusPreds, setBonusPreds] = useState<Record<string, { value: string; saved: boolean; points?: number | null }>>(() => {
    const map: Record<string, { value: string; saved: boolean; points?: number | null }> = {}
    for (const s of initialSpecials) {
      const bonusType = BONUS_TYPES.find(b => b.type === s.type)
      if (!bonusType) continue
      const val = getStoredValue(s, bonusType)
      if (val) map[s.type] = { value: val, saved: true, points: s.points }
    }
    return map
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredTeams = teams.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  )

  async function saveTeam(type: string) {
    const pred = teamPreds[type]
    if (!pred?.team) { toast.error('Selecciona un equipo'); return }
    setSaving(type)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/special-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, teamName: pred.team }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setTeamPreds(prev => ({ ...prev, [type]: { ...prev[type], saved: true } }))
      toast.success('¡Predicción guardada!')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  async function saveBonus(type: string, bonusType: BonusType) {
    const pred = bonusPreds[type]
    if (!pred?.value?.trim()) { toast.error('Selecciona una opción'); return }
    setSaving(type)
    try {
      const body = bonusType.kind === 'team'
        ? { type, teamName: pred.value }
        : { type, playerName: pred.value }
      const res = await fetch(`/api/pollas/${pollaId}/special-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setBonusPreds(prev => ({ ...prev, [type]: { ...prev[type], saved: true } }))
      toast.success('¡Predicción guardada!')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function selectTeam(type: string, team: string) {
    setTeamPreds(prev => ({ ...prev, [type]: { team, saved: false } }))
  }

  function selectBonus(type: string, value: string) {
    setBonusPreds(prev => ({ ...prev, [type]: { ...(prev[type] ?? {}), value, saved: false } }))
  }

  const activeBonusTypes = BONUS_TYPES.filter(({ featureKey }) =>
    config['feature_bonus_predictions'] === 'true' && config[featureKey] === 'true'
  )

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-center text-destructive-foreground">
          ⏰ Las predicciones especiales están cerradas — el torneo ya comenzó
        </div>
      )}

      {TEAM_TYPES.map(({ type, label, configKey, description }) => {
        const pred = teamPreds[type]
        const pts = getConfigValue(config, configKey, 0)

        return (
          <Card key={type} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0">+{pts} pts</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {pred?.team && (
                <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                  <span className="text-xl">{getFlag(pred.team)}</span>
                  <span className="font-semibold">{pred.team}</span>
                  {pred.points !== undefined && pred.points !== null && (
                    <Badge className="ml-auto" variant={pred.points > 0 ? 'default' : 'secondary'}>
                      +{pred.points} pts
                    </Badge>
                  )}
                </div>
              )}

              {!isLocked && (
                <>
                  <input
                    type="text"
                    placeholder="Buscar equipo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full mb-2 px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                    {filteredTeams.map(team => (
                      <button
                        key={team}
                        onClick={() => selectTeam(type, team)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                          pred?.team === team
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'bg-card border border-border hover:border-primary'
                        }`}
                      >
                        <span>{getFlag(team)}</span>
                        <span className="truncate">{team}</span>
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    className="w-full mt-3"
                    variant={pred?.saved ? 'outline' : 'default'}
                    onClick={() => saveTeam(type)}
                    disabled={saving === type || !pred?.team}
                  >
                    {saving === type ? 'Guardando...' : pred?.saved ? '✓ Guardado' : 'Guardar'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      {activeBonusTypes.length > 0 && (
        <>
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preguntas Bonus & Premios Individuales</h3>
          </div>
          {activeBonusTypes.map(bonusType => {
            const pred = bonusPreds[bonusType.type]
            const pts = getConfigValue(config, bonusType.configKey, 0)

            return (
              <Card key={bonusType.type} className="glass-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{bonusType.label}</CardTitle>
                      <CardDescription className="text-xs">{bonusType.description}</CardDescription>
                    </div>
                    {bonusType.kind !== 'range' && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0">+{pts} pts</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {pred?.value && pred.saved && (
                    <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                      {bonusType.kind === 'team' && <span className="text-xl">{getFlag(pred.value)}</span>}
                      <span className="font-semibold">{pred.value}</span>
                      {pred.points !== undefined && pred.points !== null && (
                        <Badge className="ml-auto" variant={pred.points > 0 ? 'default' : 'secondary'}>
                          +{pred.points} pts
                        </Badge>
                      )}
                    </div>
                  )}

                  {!isLocked && (
                    <>
                      {bonusType.kind === 'team' ? (
                        <>
                          <input
                            type="text"
                            placeholder="Buscar equipo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full mb-2 px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                            {filteredTeams.map(team => (
                              <button
                                key={team}
                                onClick={() => selectBonus(bonusType.type, team)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                                  pred?.value === team
                                    ? 'bg-primary text-primary-foreground font-semibold'
                                    : 'bg-card border border-border hover:border-primary'
                                }`}
                              >
                                <span>{getFlag(team)}</span>
                                <span className="truncate">{team}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : bonusType.kind === 'range' ? (
                        <div className="flex flex-col gap-2">
                          {getRangeOptions(config, bonusType.type).map(opt => (
                            <button
                              key={opt.label}
                              onClick={() => selectBonus(bonusType.type, opt.label)}
                              className={`flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors text-left ${
                                pred?.value && normChoice(pred.value) === normChoice(opt.label)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-card border border-border hover:border-primary'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className="text-xs opacity-70 shrink-0 ml-2">+{opt.points} pts</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Ej: Mbappé, Messi, Vinicius Jr..."
                          value={pred?.value ?? ''}
                          onChange={e => selectBonus(bonusType.type, e.target.value)}
                          className="w-full mb-3 px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      )}

                      <Button
                        size="sm"
                        className="w-full mt-3"
                        variant={pred?.saved ? 'outline' : 'default'}
                        onClick={() => saveBonus(bonusType.type, bonusType)}
                        disabled={saving === bonusType.type || !pred?.value?.trim()}
                      >
                        {saving === bonusType.type ? 'Guardando...' : pred?.saved ? '✓ Guardado' : 'Guardar'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
