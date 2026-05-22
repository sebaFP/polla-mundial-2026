'use client'

import { useState } from 'react'
import { SpecialPrediction } from '@/lib/db/schema'
import { getFlag } from '@/lib/teams'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getConfigValue } from '@/lib/scoring'

type Props = {
  teams: string[]
  initialSpecials: SpecialPrediction[]
  config: Record<string, string>
  isLocked: boolean
}

const TEAM_TYPES = [
  { type: 'champion', label: '🏆 Campeón', configKey: 'points_champion', description: 'Equipo que ganará el Mundial' },
  { type: 'finalist', label: '🥈 Finalista', configKey: 'points_finalist', description: 'Equipo que llega a la final y pierde' },
  { type: 'third', label: '🥉 Tercer Lugar', configKey: 'points_third_place', description: 'Equipo que gana el partido por el 3° lugar' },
]

const PLAYER_TYPES = [
  { type: 'top_scorer', label: '⚽ Goleador', configKey: 'points_top_scorer', featureKey: 'feature_top_scorer', description: 'Máximo goleador del torneo' },
  { type: 'best_goalkeeper', label: '🧤 Mejor Arquero', configKey: 'points_best_goalkeeper', featureKey: 'feature_best_goalkeeper', description: 'Mejor portero del torneo' },
  { type: 'best_player', label: '⭐ Mejor Jugador', configKey: 'points_best_player', featureKey: 'feature_best_player', description: 'Jugador más destacado del torneo (Balón de Oro)' },
]

export default function SpecialPredictionsForm({ teams, initialSpecials, config, isLocked }: Props) {
  const [teamPreds, setTeamPreds] = useState<Record<string, { team: string; saved: boolean; points?: number | null }>>(() => {
    const map: Record<string, { team: string; saved: boolean; points?: number | null }> = {}
    for (const s of initialSpecials) {
      if (s.teamName) map[s.type] = { team: s.teamName, saved: true, points: s.points }
    }
    return map
  })
  const [playerPreds, setPlayerPreds] = useState<Record<string, { player: string; saved: boolean; points?: number | null }>>(() => {
    const map: Record<string, { player: string; saved: boolean; points?: number | null }> = {}
    for (const s of initialSpecials) {
      if (s.playerName) map[s.type] = { player: s.playerName, saved: true, points: s.points }
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
      const res = await fetch('/api/special-predictions', {
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

  async function savePlayer(type: string) {
    const pred = playerPreds[type]
    if (!pred?.player?.trim()) { toast.error('Ingresa un nombre de jugador'); return }
    setSaving(type)
    try {
      const res = await fetch('/api/special-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, playerName: pred.player.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setPlayerPreds(prev => ({ ...prev, [type]: { ...prev[type], saved: true } }))
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

  function setPlayerInput(type: string, player: string) {
    setPlayerPreds(prev => ({ ...prev, [type]: { ...(prev[type] ?? {}), player, saved: false } }))
  }

  const activePlayerTypes = PLAYER_TYPES.filter(({ featureKey }) => config[featureKey] === 'true')

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

      {activePlayerTypes.length > 0 && (
        <>
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Premios Individuales</h3>
          </div>
          {activePlayerTypes.map(({ type, label, configKey, description }) => {
            const pred = playerPreds[type]
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
                  {pred?.player && pred.saved && (
                    <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                      <span className="font-semibold">{pred.player}</span>
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
                        placeholder="Ej: Mbappé, Messi, Vinicius Jr..."
                        value={pred?.player ?? ''}
                        onChange={e => setPlayerInput(type, e.target.value)}
                        className="w-full mb-3 px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        variant={pred?.saved ? 'outline' : 'default'}
                        onClick={() => savePlayer(type)}
                        disabled={saving === type || !pred?.player?.trim()}
                      >
                        {saving === type ? 'Guardando...' : pred?.saved ? '✓ Guardado' : 'Guardar'}
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
