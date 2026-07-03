'use client'

import { useState, useMemo, useEffect } from 'react'
import { Match, Prediction } from '@/lib/db/schema'
import { STAGES, STAGE_ORDER, getFlag } from '@/lib/teams'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { format, isPast, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

const MATCH_POLL_INTERVAL = 30_000

type Props = {
  matches: Match[]
  initialPredictions: Prediction[]
  userId: string
  pollaId: string
  knockoutMode?: string
  lockMode?: string
  predictionUnlocked?: boolean
}

type PredictionMap = Record<number, { s1: number | string; s2: number | string; saved: boolean; points?: number | null }>

const GROUP_STAGE_MATCHDAYS = ['Jornada 1', 'Jornada 2', 'Jornada 3']

function getStatusBadge(match: Match, locked: boolean) {
  if (match.status === 'FINISHED')
    return <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs">Finalizado</Badge>
  if (match.status === 'IN_PLAY')
    return <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs animate-live-pulse">● En Vivo</Badge>
  if (match.status === 'PAUSED')
    return <Badge className="bg-yellow-900/60 text-yellow-300 border-yellow-700 text-xs animate-live-pulse">Entretiempo</Badge>
  if (locked)
    return <Badge variant="destructive" className="text-xs">Cerrado</Badge>
  return <Badge variant="outline" className="text-xs text-muted-foreground border-border/50">Por jugar</Badge>
}

export default function MatchPredictions({ matches, initialPredictions, userId, pollaId, knockoutMode = 'api', lockMode = 'match', predictionUnlocked = false }: Props) {
  const [liveMatches, setLiveMatches] = useState<Match[]>(matches)
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

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch(`/api/pollas/${pollaId}/matches`, { cache: 'no-store' })
        if (res.ok) setLiveMatches(await res.json())
      } catch { /* ignore */ }
    }
    const interval = setInterval(fetchMatches, MATCH_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [pollaId])

  const stages = useMemo(() => {
    const available = new Set(liveMatches.map(m => m.stage))
    return STAGE_ORDER.filter(s => available.has(s))
  }, [liveMatches])

  const groups = useMemo(() => {
    const gs = new Set(liveMatches.filter(m => m.stage === 'GROUP_STAGE').map(m => m.groupName).filter(Boolean))
    return Array.from(gs).sort() as string[]
  }, [liveMatches])

  const activeGroup = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? ''

  const activeKnockoutStage = useMemo(() => {
    if (knockoutMode !== 'sequential') return null
    const knockoutStages = STAGE_ORDER.filter(s => s !== 'GROUP_STAGE')
    for (const s of knockoutStages) {
      const prevStage = s === 'LAST_32' ? 'GROUP_STAGE' : STAGE_ORDER[STAGE_ORDER.indexOf(s) - 1]
      const prevMatches = liveMatches.filter(m => m.stage === prevStage)
      if (prevMatches.length === 0 || !prevMatches.every(m => m.status === 'FINISHED')) return null
      const thisMatches = liveMatches.filter(m => m.stage === s)
      if (thisMatches.length === 0 || !thisMatches.every(m => m.status === 'FINISHED')) return s
    }
    return null
  }, [liveMatches, knockoutMode])

  function isStageAccessible(s: string): boolean {
    if (s === 'GROUP_STAGE') return true
    if (knockoutMode !== 'sequential') return true
    return s === activeKnockoutStage
  }

  function prevStageName(s: string): string {
    const prevStage = s === 'LAST_32' ? 'GROUP_STAGE' : STAGE_ORDER[STAGE_ORDER.indexOf(s) - 1]
    return STAGES[prevStage] ?? prevStage
  }

  const visibleMatches = useMemo(() => {
    if (stage === 'GROUP_STAGE') {
      const group = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? ''
      return liveMatches.filter(m => m.stage === 'GROUP_STAGE' && m.groupName === group)
        .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
    }
    return liveMatches.filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
  }, [liveMatches, stage, selectedGroup, groups])

  const currentlyLive = useMemo(
    () => liveMatches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED'),
    [liveMatches]
  )

  const lockTimeMap = useMemo<Record<number, Date | null>>(() => {
    const map: Record<number, Date | null> = {}
    if (lockMode === 'total') {
      let globalMin: Date | null = null
      for (const m of liveMatches) {
        if (!m.lockTime) continue
        const t = new Date(m.lockTime)
        if (!globalMin || t < globalMin) globalMin = t
      }
      for (const m of liveMatches) map[m.id] = globalMin
    } else if (lockMode === 'phase') {
      const stageMin: Record<string, Date | null> = {}
      for (const m of liveMatches) {
        if (!m.lockTime) continue
        const t = new Date(m.lockTime)
        if (!stageMin[m.stage] || t < stageMin[m.stage]!) stageMin[m.stage] = t
      }
      for (const m of liveMatches) map[m.id] = stageMin[m.stage] ?? null
    } else {
      for (const m of liveMatches) map[m.id] = m.lockTime ? new Date(m.lockTime) : null
    }
    return map
  }, [liveMatches, lockMode])

  function isLocked(match: Match): boolean {
    if (predictionUnlocked) return false
    const t = lockTimeMap[match.id]
    return t ? new Date() >= t : false
  }

  async function savePrediction(matchId: number) {
    const pred = preds[matchId]
    if (!pred) return
    setSaving(matchId)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, predictedScore1: Number(pred.s1), predictedScore2: Number(pred.s2) }),
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
    if (val !== '') {
      const n = parseInt(val)
      if (isNaN(n) || n < 0 || n > 30) return
    }
    setPreds(prev => ({ ...prev, [matchId]: { ...(prev[matchId] ?? { s1: '', s2: '' }), [which]: val === '' ? '' : parseInt(val), saved: false } }))
  }

  return (
    <div className="space-y-4">
      {/* Live now banner */}
      {currentlyLive.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-red-900/50" style={{ background: 'rgba(127,0,0,0.12)' }}>
          <div className="px-4 py-2.5 border-b border-red-900/30 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-live-pulse shrink-0" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">En Vivo Ahora</span>
          </div>
          <div className="p-3 space-y-2">
            {currentlyLive.map(match => {
              const pred = preds[match.id]
              return (
                <div key={match.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card/50">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-base leading-none">{getFlag(match.team1)}</span>
                    <span className="font-semibold text-sm truncate">{match.team1}</span>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-2xl font-black font-mono text-primary leading-none">
                      {match.score1 ?? '?'} – {match.score2 ?? '?'}
                    </div>
                    {pred && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Tu pronóstico: {pred.s1}–{pred.s2}
                      </div>
                    )}
                    {match.status === 'PAUSED' && (
                      <div className="text-xs text-yellow-400/80 mt-0.5">Entretiempo</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className="font-semibold text-sm truncate text-right">{match.team2}</span>
                    <span className="text-base leading-none">{getFlag(match.team2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stage selector */}
      <div className="flex flex-wrap gap-2">
        {stages.map(s => {
          const accessible = isStageAccessible(s)
          return (
            <Button
              key={s}
              variant={stage === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStage(s)}
              disabled={!accessible}
              className={`text-xs ${!accessible ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={!accessible ? `Disponible cuando finalice ${prevStageName(s)}` : undefined}
            >
              {STAGES[s] ?? s}
              {!accessible && <span className="ml-1">🔒</span>}
            </Button>
          )
        })}
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
        {!isStageAccessible(stage) && (
          <div className="text-center py-10 space-y-2">
            <p className="text-3xl">🔒</p>
            <p className="text-sm font-medium text-muted-foreground">
              Esta ronda se abre cuando finalice {prevStageName(stage)}
            </p>
          </div>
        )}
        {isStageAccessible(stage) && visibleMatches.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No hay partidos disponibles aún</p>
        )}
        {isStageAccessible(stage) && visibleMatches.map(match => {
          const locked = isLocked(match)
          const pred = preds[match.id]
          const isDirty = pred && !pred.saved
          const teamsUnresolved = !match.team1Resolved || !match.team2Resolved

          if (teamsUnresolved) {
            return (
              <Card key={match.id} className="glass-card p-4 opacity-60">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(match.matchDatetime), "d MMM, HH:mm", { locale: es })}
                  </span>
                  <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">Próximamente</Badge>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-lg leading-none">🏳️</span>
                    <span className="font-semibold text-sm text-muted-foreground truncate">
                      {match.team1Resolved ? match.team1 : 'Por confirmar'}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs font-mono shrink-0">vs</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className="font-semibold text-sm text-muted-foreground truncate text-right">
                      {match.team2Resolved ? match.team2 : 'Por confirmar'}
                    </span>
                    <span className="text-lg leading-none">🏳️</span>
                  </div>
                </div>
              </Card>
            )
          }

          return (
            <Card key={match.id} className="glass-card p-4">
              {/* Header: status + date */}
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(match, locked)}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(match.matchDatetime), "d MMM, HH:mm", { locale: es })}
                </span>
                {match.venue && <span className="text-xs text-muted-foreground hidden sm:inline">• {match.venue}</span>}
              </div>

              {/* Teams row — full width */}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-lg leading-none">{getFlag(match.team1)}</span>
                  <span className="font-semibold text-sm truncate">{match.team1}</span>
                </div>
                <span className="text-muted-foreground text-xs font-mono shrink-0">vs</span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <span className="font-semibold text-sm truncate text-right">{match.team2}</span>
                  <span className="text-lg leading-none">{getFlag(match.team2)}</span>
                </div>
              </div>

              {/* Score / inputs row */}
              {match.status === 'FINISHED' && match.score1 !== null ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-bold font-mono text-primary">
                      {match.score1} - {match.score2}
                    </div>
                    {match.score1Penalties != null && match.score2Penalties != null && (
                      <span className="text-xs text-muted-foreground font-mono">
                        (pen {match.score1Penalties}-{match.score2Penalties})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {pred?.points !== undefined && pred?.points !== null && (
                      <span className={`text-xs font-bold ${pred.points > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                        +{pred.points} pts
                      </span>
                    )}
                    {pred && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Tu: {pred.s1}-{pred.s2}
                      </div>
                    )}
                  </div>
                </div>
              ) : (match.status === 'IN_PLAY' || match.status === 'PAUSED') ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-xl font-bold font-mono text-primary">
                    {match.score1 ?? '?'} - {match.score2 ?? '?'}
                  </div>
                  <div className="text-right">
                    {pred ? (
                      <div className="text-xs text-muted-foreground">Tu: {pred.s1}-{pred.s2}</div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin pronóstico</span>
                    )}
                  </div>
                </div>
              ) : locked ? (
                <div className="mt-3">
                  {pred ? (
                    <div className="text-lg font-bold font-mono text-muted-foreground">
                      {pred.s1} - {pred.s2}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin pronóstico</span>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-2">
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
                  {!['LIVE', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status ?? '') && (
                    <Button
                      size="sm"
                      variant={isDirty ? 'default' : 'outline'}
                      onClick={() => savePrediction(match.id)}
                      disabled={saving === match.id || !pred || pred.s1 === '' || pred.s2 === '' || (pred.s1 === undefined && pred.s2 === undefined)}
                      className="text-xs"
                    >
                      {saving === match.id ? 'Guardando...' : pred?.saved ? '✓' : 'Guardar'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
