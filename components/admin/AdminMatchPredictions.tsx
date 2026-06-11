'use client'

import { useState, useMemo } from 'react'
import { Match, Prediction } from '@/lib/db/schema'
import { STAGES, STAGE_ORDER, getFlag } from '@/lib/teams'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Props = {
  matches: Match[]
  initialPredictions: Prediction[]
  targetUserId: string
  pollaId: string
}

type PredMap = Record<number, { s1: string; s2: string; saved: boolean; points?: number | null }>

export default function AdminMatchPredictions({ matches, initialPredictions, targetUserId, pollaId }: Props) {
  const [stage, setStage] = useState('GROUP_STAGE')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [preds, setPreds] = useState<PredMap>(() => {
    const map: PredMap = {}
    for (const p of initialPredictions) {
      map[p.matchId] = { s1: String(p.predictedScore1), s2: String(p.predictedScore2), saved: true, points: p.points }
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
      return matches.filter(m => m.stage === 'GROUP_STAGE' && m.groupName === activeGroup)
        .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
    }
    return matches.filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
  }, [matches, stage, activeGroup])

  async function save(matchId: number) {
    const pred = preds[matchId]
    if (!pred) return
    const s1 = Number(pred.s1)
    const s2 = Number(pred.s2)
    if (isNaN(s1) || isNaN(s2)) { toast.error('Marcador inválido'); return }
    setSaving(matchId)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, predictedScore1: s1, predictedScore2: s2, targetUserId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setPreds(prev => ({ ...prev, [matchId]: { ...prev[matchId], saved: true, points: data.points } }))
      toast.success('Guardado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function setScore(matchId: number, field: 's1' | 's2', val: string) {
    setPreds(prev => ({ ...prev, [matchId]: { ...(prev[matchId] ?? { s1: '', s2: '', saved: false }), [field]: val, saved: false } }))
  }

  const savedCount = Object.values(preds).filter(p => p.saved).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{savedCount} de {matches.length} partidos ingresados</span>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {stages.map(s => (
          <button
            key={s}
            onClick={() => { setStage(s); setSelectedGroup('') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stage === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {STAGES[s] ?? s}
          </button>
        ))}
      </div>

      {/* Group selector */}
      {stage === 'GROUP_STAGE' && (
        <div className="flex gap-1 flex-wrap">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                activeGroup === g
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted border border-transparent'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Matches */}
      <div className="space-y-2">
        {visibleMatches.map(m => {
          const pred = preds[m.id]
          const hasResult = m.score1 !== null && m.score2 !== null
          return (
            <Card key={m.id} className="glass-card p-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex-1 text-right">
                  <p className="font-medium">{getFlag(m.team1)} {m.team1}</p>
                </div>

                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={pred?.s1 ?? ''}
                      onChange={e => setScore(m.id, 's1', e.target.value)}
                      className="score-input w-10 text-center"
                      placeholder="—"
                    />
                    <span className="text-muted-foreground font-bold">–</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={pred?.s2 ?? ''}
                      onChange={e => setScore(m.id, 's2', e.target.value)}
                      className="score-input w-10 text-center"
                      placeholder="—"
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={saving === m.id || pred?.s1 === '' || pred?.s2 === '' || pred?.saved}
                      onClick={() => save(m.id)}
                    >
                      {saving === m.id ? '…' : pred?.saved ? '✓' : 'OK'}
                    </Button>
                  </div>
                  {hasResult && (
                    <p className="text-[10px] text-muted-foreground">real: {m.score1}–{m.score2}</p>
                  )}
                  {pred?.points != null && (
                    <Badge className="text-[10px] px-1 py-0 bg-primary/15 text-primary border-primary/30">
                      +{pred.points} pts
                    </Badge>
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-medium">{getFlag(m.team2)} {m.team2}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(m.matchDatetime), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
