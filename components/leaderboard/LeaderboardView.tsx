'use client'

import { useEffect, useState } from 'react'
import { LeaderboardEntry } from '@/app/api/leaderboard/route'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const POLL_INTERVAL = 30_000 // 30s

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return <span className="text-sm font-bold text-muted-foreground w-8 text-center">{rank}</span>
}

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : [top3[0]]

  return (
    <div className="flex items-end justify-center gap-3 py-6">
      {order.map((entry, i) => {
        const actualRank = entry.rank
        const heights = top3.length >= 3
          ? [actualRank === 2 ? 'h-20' : actualRank === 1 ? 'h-28' : 'h-16']
          : ['h-28']

        return (
          <div key={entry.userId} className="flex flex-col items-center gap-2">
            <div className="text-center">
              <Avatar className="w-12 h-12 mx-auto" style={{ borderColor: entry.avatarColor ?? undefined, borderWidth: 2 }}>
                <AvatarFallback style={{ backgroundColor: entry.avatarColor ?? '#f59e0b', color: '#000' }} className="font-bold">
                  {entry.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs font-semibold mt-1 max-w-16 truncate text-center">{entry.name}</p>
              <p className="text-sm font-bold text-primary">{entry.totalPoints} pts</p>
            </div>
            <div
              className={`w-20 rounded-t-lg flex items-center justify-center ${
                actualRank === 1 ? 'bg-amber-500/30 border border-amber-500/50' :
                actualRank === 2 ? 'bg-slate-400/20 border border-slate-400/40' :
                'bg-orange-700/20 border border-orange-700/40'
              } ${heights[0] ?? 'h-20'}`}
            >
              <RankBadge rank={actualRank} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LeaderboardView({ currentUserId }: { currentUserId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-card/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="glass-card p-8 text-center text-muted-foreground">
        <p className="text-4xl mb-3">🏆</p>
        <p>Aún no hay participantes registrados</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Podium entries={entries} />

      <div className="space-y-2">
        {entries.map(entry => {
          const isMe = entry.userId === currentUserId
          return (
            <Card
              key={entry.userId}
              className={`p-3 transition-all ${
                isMe ? 'border-primary/50 bg-primary/5' : 'glass-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 flex justify-center shrink-0">
                  <RankBadge rank={entry.rank} />
                </div>

                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: entry.avatarColor ?? '#f59e0b', color: '#000' }}
                    className="text-xs font-bold"
                  >
                    {entry.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{entry.name}</p>
                    {isMe && <Badge className="text-xs bg-primary/20 text-primary border-primary/30 shrink-0">Tú</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span title="Partidos">⚽ {entry.matchPoints}</span>
                    <span title="Grupos">🏅 {entry.groupPoints}</span>
                    <span title="Especiales">⭐ {entry.specialPoints}</span>
                    <span className="text-muted-foreground/60">
                      {entry.scoredMatches}/{entry.predictedMatches} partidos
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-lg text-primary font-mono">{entry.totalPoints}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Actualización automática cada 30s
      </p>
    </div>
  )
}
