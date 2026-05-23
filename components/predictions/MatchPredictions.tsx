'use client'

import { useState, useMemo } from 'react'
import { Match, Prediction } from '@/lib/db/schema'
import { STAGES, STAGE_ORDER, getFlag } from '@/lib/teams'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { format, isPast, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

type Props = {
  matches: Match[]
  initialPredictions: Prediction[]
  userId: string
  pollaId: string
}

type PredictionMap = Record<number, { s1: number; s2: number; saved: boolean; points?: number | null }>

const GROUP_STAGE_MATCHDAYS = ['Jornada 1', 'Jornada 2', 'Jornada 3']

function isLocked(match: Match): boolean {
  if (!match.lockTime) return false
  return new Date() >= new Date(match.lockTime)
}

function getStatusBadge(match: Match, locked: boolean) {
  if (match.status === 'FINISHED') return <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs">FIN</Badge>
  if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return (
    <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs animate-live-pulse">EN VIVO</Badge>
  )
  if (locked) return <Badge variant="destructive" className="text-xs">CERRADO</Badge>
  return null
}

export default function MatchPredictions({ matches, initialPredictions, userId, pollaId }: Props) {
  const [stage, setStage] = useState<string>('GROUP_STAGE')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [preds, setPreds] = useState<PredictionMap>(() => {
    const map: PredictionMap = {}
    for (const p of initialPredictions) {
      map[p.matchId] = { s1: p.predictedScore1, s2: p.predictedScore2, saved: true, points: p.points }
    }
    return map
  })
  const [saving, setSaving] = useState<number | null>(null)

  const stages = useMemo(() => {
    const available = new Set(matches.map(m => m.stage))
    return STAGE_ORDER.filter(s => available.has(s))
  }, [matches])

  const groups = useMemo(() => {
    const gs = new Set(matches.filter(m => m.stage === 'GROUP_STAGE').map(m => m.groupName).filter(Boolean))
    return Array.from(gs).sort() as string[]
  }, [matches])

  const activeGroup = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? ''

  const visibleMatches = useMemo(() => {
    if (stage === 'GROUP_STAGE') {
      const group = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? ''
      return matches.filter(m => m.stage === 'GROUP_STAGE' && m.groupName === group)
        .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
    }
    return matches.filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
  }, [matches, stage, selectedGroup, groups])

  async function savePrediction(matchId: number) {
    const pred = preds[matchId]
    if (!pred) return
    setSaving(matchId)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, predictedScore1: pred.s1, predictedScore2: pred.s2 }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setPreds(prev => ({ ...prev, [matchId]: { ...prev[matchId], saved: true } }))
      toast.success('¡Pronóstico guardado!')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function updateScore(matchId: number, which: 's1' | 's2', val: string) {
    const n = parseInt(val)
    if (isNaN(n) || n < 0 || n > 30) return
    setPreds(prev => ({ ...prev, [matchId]: { ...(prev[matchId] ?? { s1: 0, s2: 0 }), [which]: n, saved: false } }))
  }

  return (
    <div className="space-y-4">
      {/* Stage selector */}
      <div className="flex flex-wrap gap-2">
        {stages.map(s => (
          <Button
            key={s}
            variant={stage === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStage(s)}
            className="text-xs"
          >
            {STAGES[s] ?? s}
          </Button>
        ))}
      </div>

      {/* Group selector for group stage */}
      {stage === 'GROUP_STAGE' && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeGroup === g
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {g.replace('GROUP_', 'G').replace('Group ', 'G')}
            </button>
          ))}
        </div>
      )}

      {/* Matches */}
      <div className="space-y-3">
        {visibleMatches.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No hay partidos disponibles aún</p>
        )}
        {visibleMatches.map(match => {
          const locked = isLocked(match)
          const pred = preds[match.id]
          const isDirty = pred && !pred.saved
          const teamsUnresolved = !match.team1Resolved || !match.team2Resolved

          if (teamsUnresolved) {
            return (
              <Card key={match.id} className="glass-card p-4 opacity-60">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(match.matchDatetime), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-lg leading-none">🏳️</span>
                        <span className="font-semibold text-sm text-muted-foreground truncate">
                          {match.team1Resolved ? match.team1 : 'Por confirmar'}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs font-mono shrink-0">vs</span>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-row-reverse sm:flex-row">
                        <span className="font-semibold text-sm text-muted-foreground truncate">
                          {match.team2Resolved ? match.team2 : 'Por confirmar'}
                        </span>
                        <span className="text-lg leading-none">🏳️</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Badge variant="outline" className="text-xs text-muted-foreground">Próximamente</Badge>
                  </div>
                </div>
              </Card>
            )
          }

          return (
            <Card key={match.id} className="glass-card p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Match info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(match, locked)}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(match.matchDatetime), "d MMM, HH:mm", { locale: es })}
                    </span>
                    {match.venue && <span className="text-xs text-muted-foreground hidden sm:inline">• {match.venue}</span>}
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-lg leading-none">{getFlag(match.team1)}</span>
                      <span className="font-semibold text-sm truncate">{match.team1}</span>
                    </div>
                    <span className="text-muted-foreground text-xs font-mono shrink-0">vs</span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-row-reverse sm:flex-row">
                      <span className="font-semibold text-sm truncate">{match.team2}</span>
                      <span className="text-lg leading-none">{getFlag(match.team2)}</span>
                    </div>
                  </div>
                </div>

                {/* Score area */}
                <div className="shrink-0">
                  {match.status === 'FINISHED' && match.score1 !== null ? (
                    <div className="text-center">
                      <div className="text-xl font-bold font-mono text-primary">
                        {match.score1} - {match.score2}
                      </div>
                      {pred?.points !== undefined && pred?.points !== null && (
                        <div className="text-xs text-center mt-1">
                          <span className={`font-bold ${pred.points > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                            +{pred.points} pts
                          </span>
                        </div>
                      )}
                      {pred && (
                        <div className="text-xs text-muted-foreground text-center mt-0.5">
                          Tu: {pred.s1}-{pred.s2}
                        </div>
                      )}
                    </div>
                  ) : locked ? (
                    <div className="text-center">
                      {pred ? (
                        <div className="text-lg font-bold font-mono text-muted-foreground">
                          {pred.s1} - {pred.s2}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin pronóstico</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0} max={30}
                        className="score-input"
                        value={pred?.s1 ?? ''}
                        placeholder="0"
                        onChange={e => updateScore(match.id, 's1', e.target.value)}
                      />
                      <span className="text-muted-foreground font-mono">-</span>
                      <input
                        type="number"
                        min={0} max={30}
                        className="score-input"
                        value={pred?.s2 ?? ''}
                        placeholder="0"
                        onChange={e => updateScore(match.id, 's2', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Save button */}
              {!locked && match.status === 'SCHEDULED' && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant={isDirty ? 'default' : 'outline'}
                    onClick={() => savePrediction(match.id)}
                    disabled={saving === match.id || !pred || (pred.s1 === undefined && pred.s2 === undefined)}
                    className="text-xs"
                  >
                    {saving === match.id ? 'Guardando...' : pred?.saved ? '✓ Guardado' : 'Guardar'}
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
