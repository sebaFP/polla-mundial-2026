'use client'

import { useState } from 'react'
import { Match, GroupPrediction, GroupStanding } from '@/lib/db/schema'
import { getFlag } from '@/lib/teams'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Props = {
  groupsMap: Record<string, string[]>
  initialPredictions: GroupPrediction[]
  matches: Match[]
  standings: GroupStanding[]
  pollaId: string
  lockedGroupNames?: string[]
  predictionUnlocked?: boolean
}

type PredState = {
  first: string
  second: string
  third: string
  saved: boolean
  manualOverride: boolean
}

function isGroupLocked(groupName: string, matches: Match[]): boolean {
  const groupMatches = matches.filter(m => m.groupName === groupName)
  if (groupMatches.length === 0) return false
  const first = groupMatches.reduce((e, m) => new Date(m.matchDatetime) < new Date(e.matchDatetime) ? m : e)
  return first.lockTime ? new Date() >= new Date(first.lockTime) : false
}

export default function GroupPredictionsForm({ groupsMap, initialPredictions, matches, standings, pollaId, lockedGroupNames = [], predictionUnlocked = false }: Props) {
  const adminLockedSet = predictionUnlocked ? new Set<string>() : new Set(lockedGroupNames)

  const [preds, setPreds] = useState<Record<string, PredState>>(() => {
    const map: Record<string, PredState> = {}
    for (const p of initialPredictions) {
      map[p.groupName] = {
        first: p.firstPlace,
        second: p.secondPlace,
        third: p.thirdPlace ?? '',
        saved: true,
        manualOverride: p.isManualOverride,
      }
    }
    return map
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)

  const groups = Object.keys(groupsMap).sort()

  async function save(groupName: string) {
    const pred = preds[groupName]
    if (!pred?.first || !pred?.second) { toast.error('Selecciona 1° y 2° lugar'); return }
    if (pred.first === pred.second) { toast.error('Deben ser equipos diferentes'); return }
    if (pred.third && (pred.third === pred.first || pred.third === pred.second)) { toast.error('El 3° debe ser diferente al 1° y 2°'); return }
    setSaving(groupName)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/group-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, firstPlace: pred.first, secondPlace: pred.second, thirdPlace: pred.third || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setPreds(prev => ({ ...prev, [groupName]: { ...prev[groupName], saved: true, manualOverride: true } }))
      toast.success(`Grupo ${groupName.replace('GROUP_', '')} guardado`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  async function resetToAuto(groupName: string) {
    setResetting(groupName)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/group-predictions/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) { toast.error('Error al restablecer'); return }
      if (data) {
        setPreds(prev => ({
          ...prev,
          [groupName]: {
            first: data.firstPlace,
            second: data.secondPlace,
            third: data.thirdPlace ?? '',
            saved: true,
            manualOverride: false,
          },
        }))
        toast.success('Restablecido al cálculo automático')
      } else {
        setPreds(prev => {
          const next = { ...prev }
          delete next[groupName]
          return next
        })
        toast.success('Override eliminado — sin predicciones de partidos aún')
      }
    } catch {
      toast.error('Error al restablecer')
    } finally {
      setResetting(null)
    }
  }

  function update(groupName: string, which: 'first' | 'second' | 'third', team: string) {
    setPreds(prev => ({ ...prev, [groupName]: { ...(prev[groupName] ?? { first: '', second: '', third: '', saved: false, manualOverride: false }), [which]: team, saved: false } }))
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(groupName => {
        const teams = groupsMap[groupName]
        const pred = preds[groupName]
        const locked = !predictionUnlocked && isGroupLocked(groupName, matches)
        const adminLocked = adminLockedSet.has(groupName)
        const groupStandings = standings
          .filter(s => s.groupName === groupName)
          .sort((a, b) => {
            if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
            return ((b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)) - ((a.goalsFor ?? 0) - (a.goalsAgainst ?? 0))
          })

        return (
          <Card key={groupName} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-primary">
                  {groupName.replace('GROUP_', 'Grupo ')}
                </CardTitle>
                {locked && <Badge variant="destructive" className="text-xs">Cerrado</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Actual standings if available */}
              {groupStandings.length > 0 && (
                <div className="text-xs space-y-1 mb-2">
                  {groupStandings.map((s, i) => (
                    <div key={s.teamName} className="flex items-center gap-2">
                      <span className={`w-4 text-center font-bold ${i < 2 ? 'text-primary' : 'text-muted-foreground'}`}>{i + 1}</span>
                      <span>{getFlag(s.teamName)}</span>
                      <span className="flex-1 text-muted-foreground">{s.teamName}</span>
                      <span className="font-mono font-bold text-primary">{s.points}pts</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual override warning */}
              {pred?.manualOverride && !locked && (
                <div className="rounded-md bg-amber-900/20 border border-amber-700/40 p-2 text-xs space-y-1.5">
                  <p className="text-amber-300">Selección manual activa — sobreescribe el cálculo automático</p>
                  <button
                    onClick={() => resetToAuto(groupName)}
                    disabled={resetting === groupName}
                    className="text-amber-400 underline underline-offset-2 hover:text-amber-200 disabled:opacity-50"
                  >
                    {resetting === groupName ? 'Restableciendo...' : 'Restablecer al automático'}
                  </button>
                </div>
              )}

              {/* Admin locked standings notice */}
              {adminLocked && (
                <div className="rounded-md bg-yellow-900/20 border border-yellow-700/40 p-2 text-xs text-yellow-300">
                  Clasificación fijada por el admin
                </div>
              )}

              {/* Auto-calc badge */}
              {pred && !pred.manualOverride && pred.saved && !locked && (
                <div className="text-xs text-muted-foreground italic">
                  Calculado automáticamente desde tus pronósticos
                </div>
              )}

              {/* Predictions */}
              {(['first', 'second', 'third'] as const).map(which => (
                <div key={which}>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {which === 'first' ? '🥇 1° Lugar' : which === 'second' ? '🥈 2° Lugar' : '🥉 3° Lugar'}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {teams.map(team => {
                      const isSelected = pred?.[which] === team
                      const isBlockedByOther = (
                        (which === 'first' && (pred?.second === team || pred?.third === team)) ||
                        (which === 'second' && (pred?.first === team || pred?.third === team)) ||
                        (which === 'third' && (pred?.first === team || pred?.second === team))
                      )
                      return (
                        <button
                          key={team}
                          onClick={() => !locked && update(groupName, which, team)}
                          disabled={locked || isBlockedByOther}
                          className={`flex items-center gap-1.5 px-2 py-2 rounded text-xs transition-colors text-left min-h-[40px] ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : isBlockedByOther
                              ? 'opacity-30 cursor-not-allowed bg-card'
                              : locked
                              ? 'bg-card text-muted-foreground cursor-not-allowed'
                              : 'bg-card border border-border text-foreground hover:border-primary cursor-pointer'
                          }`}
                        >
                          <span>{getFlag(team)}</span>
                          <span className="truncate">{team}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {!locked && (
                <Button
                  size="sm"
                  className="w-full text-xs mt-2"
                  variant={pred?.saved ? 'outline' : 'default'}
                  onClick={() => save(groupName)}
                  disabled={saving === groupName}
                >
                  {saving === groupName ? 'Guardando...' : pred?.saved ? '✓ Guardado' : 'Guardar Grupo'}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
