'use client'

import { useState, useMemo } from 'react'
import { Match } from '@/lib/db/schema'
import { getFlag, STAGES, STAGE_ORDER } from '@/lib/teams'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Props = { initialMatches: Match[]; pollaId?: string }

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'FINISHED') return <Badge className="bg-green-900/50 text-green-300 border-green-700 text-xs">FIN</Badge>
  if (status === 'IN_PLAY') return <Badge className="bg-red-900/50 text-red-300 border-red-700 text-xs animate-live-pulse">EN VIVO</Badge>
  if (status === 'PAUSED') return <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700 text-xs">PAUSA</Badge>
  return <Badge variant="outline" className="text-xs">PROG</Badge>
}

export default function ResultsManager({ initialMatches, pollaId }: Props) {
  const [matches, setMatches] = useState(initialMatches)
  const [stage, setStage] = useState<string>('GROUP_STAGE')
  const [scores, setScores] = useState<Record<number, { s1: string; s2: string }>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)

  const stages = useMemo(() => {
    const available = new Set(matches.map(m => m.stage))
    return STAGE_ORDER.filter(s => available.has(s))
  }, [matches])

  const visible = useMemo(() =>
    matches
      .filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime()),
    [matches, stage]
  )

  async function syncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/sync-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: '' }), // Admin can bypass with empty - TODO: use CRON_SECRET from env
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Sync completado: ${data.updated} partidos actualizados`)
        window.location.reload()
      } else {
        toast.error('Error en sync')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSyncing(false)
    }
  }

  async function saveResult(matchId: number) {
    const score = scores[matchId]
    if (!score) return
    const s1 = parseInt(score.s1)
    const s2 = parseInt(score.s2)
    if (isNaN(s1) || isNaN(s2)) { toast.error('Marcadores inválidos'); return }

    setSaving(matchId)
    try {
      const endpoint = pollaId
        ? `/api/pollas/${pollaId}/results/${matchId}`
        : `/api/admin/results/${matchId}`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score1: s1, score2: s2 }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, status: 'FINISHED' } : m))
      toast.success(`Resultado guardado: ${data.updated} pronósticos actualizados`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sync button */}
      <div className="flex items-center justify-between">
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
        <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing} className="text-xs">
          {syncing ? '⟳ Sincronizando...' : '⟳ Sync API'}
        </Button>
      </div>

      {/* Matches */}
      <div className="space-y-2">
        {visible.map(match => {
          const score = scores[match.id]
          return (
            <Card key={match.id} className="glass-card p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="shrink-0 min-w-0">
                  <StatusBadge status={match.status} />
                </div>

                <div className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(match.matchDatetime), 'd MMM HH:mm', { locale: es })}
                </div>

                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm">{getFlag(match.team1)}</span>
                  <span className="font-semibold text-sm truncate">{match.team1}</span>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span className="font-semibold text-sm truncate">{match.team2}</span>
                  <span className="text-sm">{getFlag(match.team2)}</span>
                </div>

                {/* Score display / input */}
                <div className="flex items-center gap-2 shrink-0">
                  {match.status === 'FINISHED' && match.score1 !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary font-mono">
                        {match.score1} - {match.score2}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-6 px-2"
                        onClick={() => setScores(prev => ({ ...prev, [match.id]: { s1: String(match.score1), s2: String(match.score2) } }))}
                      >
                        ✏️
                      </Button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={0} max={30}
                        placeholder="0"
                        value={score?.s1 ?? ''}
                        onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...(prev[match.id] ?? { s1: '', s2: '' }), s1: e.target.value } }))}
                        className="w-12 h-8 text-center text-sm font-mono font-bold rounded border border-border bg-input text-foreground focus:border-primary focus:outline-none"
                      />
                      <span className="text-muted-foreground font-mono">-</span>
                      <input
                        type="number"
                        min={0} max={30}
                        placeholder="0"
                        value={score?.s2 ?? ''}
                        onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...(prev[match.id] ?? { s1: '', s2: '' }), s2: e.target.value } }))}
                        className="w-12 h-8 text-center text-sm font-mono font-bold rounded border border-border bg-input text-foreground focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => saveResult(match.id)}
                        disabled={saving === match.id || (!score?.s1 && !score?.s2)}
                        className="text-xs h-8"
                      >
                        {saving === match.id ? '...' : 'Guardar'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
