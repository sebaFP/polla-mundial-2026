'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getFlag } from '@/lib/teams'

type TeamRow = {
  id: number
  teamName: string
  played: number | null
  won: number | null
  drawn: number | null
  lost: number | null
  goalsFor: number | null
  goalsAgainst: number | null
  points: number | null
  position: number | null
}

type LockData = {
  firstPlace: string
  secondPlace: string
  thirdPlace: string | null
  lockedAt: string | null
} | null

type GroupData = {
  groupName: string
  teams: TeamRow[]
  locked: boolean
  lock: LockData
}

type Props = {
  initialGroups: GroupData[]
  pollaId: string
}

function groupLabel(raw: string) {
  return raw.replace('GROUP_', 'Grupo ')
}

export default function GroupStandingsManager({ initialGroups, pollaId }: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [recalculating, setRecalculating] = useState(false)
  const [lockingGroup, setLockingGroup] = useState<string | null>(null)
  const [lockForm, setLockForm] = useState<Record<string, { first: string; second: string; third: string }>>({})

  async function recalcAll() {
    setRecalculating(true)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/group-standings/recalculate`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Recalculado: ${data.updated} grupos actualizados`)
        window.location.reload()
      } else {
        toast.error('Error al recalcular')
      }
    } catch {
      toast.error('Error al recalcular')
    } finally {
      setRecalculating(false)
    }
  }

  async function lockGroup(groupName: string) {
    const form = lockForm[groupName]
    if (!form?.first || !form?.second) {
      toast.error('1° y 2° lugar son obligatorios')
      return
    }
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/group-standings/${encodeURIComponent(groupName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstPlace: form.first, secondPlace: form.second, thirdPlace: form.third || null }),
      })
      if (res.ok) {
        toast.success(`Clasificación de ${groupLabel(groupName)} fijada`)
        setGroups(prev => prev.map(g => g.groupName === groupName
          ? { ...g, locked: true, lock: { firstPlace: form.first, secondPlace: form.second, thirdPlace: form.third || null, lockedAt: new Date().toISOString() } }
          : g
        ))
        setLockingGroup(null)
      } else {
        toast.error('Error al fijar clasificación')
      }
    } catch {
      toast.error('Error al fijar clasificación')
    }
  }

  async function unlockGroup(groupName: string) {
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/group-standings/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success(`Clasificación de ${groupLabel(groupName)} desbloqueada`)
        setGroups(prev => prev.map(g => g.groupName === groupName
          ? { ...g, locked: false, lock: null }
          : g
        ))
      } else {
        toast.error('Error al desbloquear')
      }
    } catch {
      toast.error('Error al desbloquear')
    }
  }

  function initLockForm(g: GroupData) {
    const topTeams = g.teams.slice(0, 3).map(t => t.teamName)
    setLockForm(prev => ({
      ...prev,
      [g.groupName]: {
        first: g.lock?.firstPlace ?? topTeams[0] ?? '',
        second: g.lock?.secondPlace ?? topTeams[1] ?? '',
        third: g.lock?.thirdPlace ?? topTeams[2] ?? '',
      },
    }))
    setLockingGroup(g.groupName)
  }

  if (groups.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-muted-foreground mb-4">No hay partidos de grupos terminados aún.</p>
        <Button onClick={recalcAll} disabled={recalculating} size="sm">
          {recalculating ? 'Calculando...' : 'Recalcular desde resultados existentes'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Clasificación calculada automáticamente desde resultados. Fija manualmente si hay empates técnicos.
        </p>
        <Button onClick={recalcAll} disabled={recalculating} size="sm" variant="outline">
          {recalculating ? 'Calculando...' : 'Recalcular todo'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map(g => (
          <Card key={g.groupName} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{groupLabel(g.groupName)}</h3>
              {g.locked && (
                <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700 text-xs">FIJADO</Badge>
              )}
            </div>

            {g.locked && g.lock && (
              <div className="rounded-md bg-yellow-900/20 border border-yellow-700/40 p-3 text-sm space-y-1">
                <p className="text-yellow-300 font-medium text-xs uppercase tracking-wide">Clasificación fijada manualmente</p>
                <p className="text-yellow-100">
                  1° {getFlag(g.lock.firstPlace)} {g.lock.firstPlace}
                  {' · '}
                  2° {getFlag(g.lock.secondPlace)} {g.lock.secondPlace}
                  {g.lock.thirdPlace && ` · 3° ${getFlag(g.lock.thirdPlace)} ${g.lock.thirdPlace}`}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-yellow-700 text-yellow-300 hover:bg-yellow-900/30 text-xs h-7"
                  onClick={() => unlockGroup(g.groupName)}
                >
                  Restablecer clasificación automática
                </Button>
              </div>
            )}

            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-white/10">
                  <th className="text-left py-1 font-normal">Equipo</th>
                  <th className="text-center py-1 font-normal w-6">PJ</th>
                  <th className="text-center py-1 font-normal w-6">G</th>
                  <th className="text-center py-1 font-normal w-6">E</th>
                  <th className="text-center py-1 font-normal w-6">P</th>
                  <th className="text-center py-1 font-normal w-10">GD</th>
                  <th className="text-center py-1 font-bold w-6">Pts</th>
                </tr>
              </thead>
              <tbody>
                {g.teams.map((t, i) => (
                  <tr key={t.teamName} className={`border-b border-white/5 ${i < 2 ? 'text-white' : 'text-muted-foreground'}`}>
                    <td className="py-1">
                      <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                      {getFlag(t.teamName)} {t.teamName}
                    </td>
                    <td className="text-center">{t.played ?? 0}</td>
                    <td className="text-center">{t.won ?? 0}</td>
                    <td className="text-center">{t.drawn ?? 0}</td>
                    <td className="text-center">{t.lost ?? 0}</td>
                    <td className="text-center">{(t.goalsFor ?? 0) - (t.goalsAgainst ?? 0)}</td>
                    <td className="text-center font-bold">{t.points ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lockingGroup === g.groupName ? (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground">Fijar clasificación definitiva:</p>
                {(['first', 'second', 'third'] as const).map((pos, idx) => (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}°</span>
                    <select
                      className="flex-1 text-xs bg-background border border-white/20 rounded px-2 py-1 text-white"
                      value={lockForm[g.groupName]?.[pos] ?? ''}
                      onChange={e => setLockForm(prev => ({
                        ...prev,
                        [g.groupName]: { ...prev[g.groupName], [pos]: e.target.value },
                      }))}
                    >
                      <option value="">{pos === 'third' ? '(Opcional)' : 'Seleccionar...'}</option>
                      {g.teams.map(t => (
                        <option key={t.teamName} value={t.teamName}>{t.teamName}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="text-xs h-7" onClick={() => lockGroup(g.groupName)}>
                    Fijar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setLockingGroup(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              !g.locked && g.teams.length > 0 && (
                <Button size="sm" variant="outline" className="text-xs h-7 w-full" onClick={() => initLockForm(g)}>
                  Fijar clasificación manualmente
                </Button>
              )
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
