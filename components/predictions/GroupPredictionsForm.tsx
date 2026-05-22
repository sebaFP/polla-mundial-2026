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
}

function isGroupLocked(groupName: string, matches: Match[]): boolean {
  const groupMatches = matches.filter(m => m.groupName === groupName)
  if (groupMatches.length === 0) return false
  const first = groupMatches.reduce((e, m) => new Date(m.matchDatetime) < new Date(e.matchDatetime) ? m : e)
  return first.lockTime ? new Date() >= new Date(first.lockTime) : false
}

export default function GroupPredictionsForm({ groupsMap, initialPredictions, matches, standings, pollaId }: Props) {
  const [preds, setPreds] = useState<Record<string, { first: string; second: string; saved: boolean }>>(() => {
    const map: Record<string, { first: string; second: string; saved: boolean }> = {}
    for (const p of initialPredictions) {
      map[p.groupName] = { first: p.firstPlace, second: p.secondPlace, saved: true }
    }
    return map
  })
  const [saving, setSaving] = useState<string | null>(null)

  const groups = Object.keys(groupsMap).sort()

  async function save(groupName: string) {
    const pred = preds[groupName]
    if (!pred?.first || !pred?.second) { toast.error('Selecciona 1° y 2° lugar'); return }
    if (pred.first === pred.second) { toast.error('Deben ser equipos diferentes'); return }
    setSaving(groupName)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/group-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, firstPlace: pred.first, secondPlace: pred.second }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setPreds(prev => ({ ...prev, [groupName]: { ...prev[groupName], saved: true } }))
      toast.success(`Grupo ${groupName.replace('Group ', '')} guardado`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function update(groupName: string, which: 'first' | 'second', team: string) {
    setPreds(prev => ({ ...prev, [groupName]: { ...(prev[groupName] ?? { first: '', second: '' }), [which]: team, saved: false } }))
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(groupName => {
        const teams = groupsMap[groupName]
        const pred = preds[groupName]
        const locked = isGroupLocked(groupName, matches)
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
                  {groupName}
                </CardTitle>
                {locked && <Badge variant="destructive" className="text-xs">Cerrado</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Current standings if available */}
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

              {/* Predictions */}
              {['first', 'second'].map(which => (
                <div key={which}>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {which === 'first' ? '🥇 1° Lugar' : '🥈 2° Lugar'}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {teams.map(team => {
                      const isSelected = pred?.[which as 'first' | 'second'] === team
                      const isOtherSelected = (which === 'first' ? pred?.second : pred?.first) === team
                      return (
                        <button
                          key={team}
                          onClick={() => !locked && update(groupName, which as 'first' | 'second', team)}
                          disabled={locked || isOtherSelected}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : isOtherSelected
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
