'use client'

import { useEffect, useState, useMemo } from 'react'
import { LeaderboardEntry } from '@/app/api/pollas/[pollaId]/leaderboard/route'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const POLL_INTERVAL = 30_000 // 30s

const FIFA_COLORS = {
  1: { border: '#E61D25', bg: 'rgba(230,29,37,0.12)', label: 'red' },   // Torch Red — Canada
  2: { border: '#2A398D', bg: 'rgba(42,57,141,0.15)', label: 'blue' },  // Hermes Blue — USA
  3: { border: '#3CAC3B', bg: 'rgba(60,172,59,0.12)', label: 'green' }, // American Green — Mexico
} as const

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl font-black" style={{ color: '#E61D25' }}>1°</span>
  if (rank === 2) return <span className="text-xl font-black" style={{ color: '#2A398D' }}>2°</span>
  if (rank === 3) return <span className="text-xl font-black" style={{ color: '#3CAC3B' }}>3°</span>
  return <span className="text-sm font-bold text-muted-foreground w-8 text-center">{rank}</span>
}

function Podium({ entries, showLive, showLiveGroups }: { entries: LeaderboardEntry[]; showLive: boolean; showLiveGroups: boolean }) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : [top3[0]]

  return (
    <div className="relative rounded-2xl overflow-hidden mb-2">
      {/* FIFA stripe header */}
      <div className="fifa-stripe w-full" style={{ height: '4px', borderRadius: 0 }} />

      <div className="flex items-end justify-center gap-3 py-6 px-4 bg-card/30 backdrop-blur-sm">
        {order.map((entry) => {
          const actualRank = entry.rank
          const colors = FIFA_COLORS[actualRank as keyof typeof FIFA_COLORS]
          const heights = top3.length >= 3
            ? (actualRank === 2 ? 'h-20' : actualRank === 1 ? 'h-28' : 'h-16')
            : 'h-28'

          return (
            <div key={entry.userId} className="flex flex-col items-center gap-2">
              <div className="text-center">
                <Avatar
                  className="w-12 h-12 mx-auto"
                  style={{ borderColor: colors?.border ?? entry.avatarColor ?? undefined, borderWidth: 2 }}
                >
                  <AvatarFallback
                    style={{ backgroundColor: entry.avatarColor ?? '#f59e0b', color: '#000' }}
                    className="font-bold text-sm"
                  >
                    {entry.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs font-semibold mt-1 max-w-20 truncate text-center">{entry.name}</p>
                <p className="text-sm font-black text-primary">
                  {(() => {
                    const confirmed = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints
                    const extra = (showLive ? entry.livePoints : 0) + (showLiveGroups ? entry.liveGroupPoints : 0)
                    return <>{confirmed + extra} pts{extra > 0 && <span className="text-yellow-400/90 text-xs ml-1">+{extra}</span>}</>
                  })()}
                </p>
              </div>
              <div
                className={`w-20 rounded-t-xl flex items-center justify-center ${heights}`}
                style={{
                  backgroundColor: colors?.bg ?? 'transparent',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: colors?.border ? `${colors.border}60` : 'transparent',
                }}
              >
                <RankBadge rank={actualRank} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Props = {
  currentUserId: string
  pollaId: string
  prizePoolEnabled: boolean
  totalPool: number
  currency: string
  prize1Pct: number
  prize2Pct: number
  prize3Pct: number
}

function formatAmount(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-CL')}`
}

export default function LeaderboardView({ currentUserId, pollaId, prizePoolEnabled, totalPool, currency, prize1Pct, prize2Pct, prize3Pct }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showLive, setShowLive] = useState(false)
  const [showLiveGroups, setShowLiveGroups] = useState(false)

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`/api/pollas/${pollaId}/leaderboard`, { cache: 'no-store' })
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

  const hasLiveMatches = entries.some(e => e.livePoints > 0)
  const hasLiveGroups = entries.some(e => e.hasLiveGroups)

  const displayEntries = useMemo(() => {
    const livePts = (e: LeaderboardEntry) =>
      (showLive ? e.livePoints : 0) + (showLiveGroups ? e.liveGroupPoints : 0)
    const sorted = entries.map(e => ({ ...e })).sort(
      (a, b) =>
        (b.matchPoints + b.pendingPoints + b.groupPoints + b.specialPoints + b.questionPoints + livePts(b)) -
        (a.matchPoints + a.pendingPoints + a.groupPoints + a.specialPoints + a.questionPoints + livePts(a))
    )
    sorted.forEach((e, i) => { e.rank = i + 1 })
    return sorted
  }, [entries, showLive, showLiveGroups])

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
      {(hasLiveMatches || hasLiveGroups) && (
        <div className="flex flex-wrap gap-2">
          {hasLiveMatches && (
            <button
              onClick={() => setShowLive(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showLive
                  ? 'bg-red-950/40 border-red-700/50 text-red-300'
                  : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full bg-red-500 ${showLive ? 'animate-live-pulse' : 'opacity-40'}`} />
              Partidos en vivo
            </button>
          )}
          {hasLiveGroups && (
            <button
              onClick={() => setShowLiveGroups(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showLiveGroups
                  ? 'bg-yellow-950/40 border-yellow-700/50 text-yellow-300'
                  : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              🏅 Grupos en curso
            </button>
          )}
        </div>
      )}

      {prizePoolEnabled && totalPool > 0 && (
        <div className="rounded-2xl overflow-hidden">
          <div className="fifa-stripe w-full" style={{ height: '3px', borderRadius: 0 }} />
          <div className="border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-3 rounded-b-2xl">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Pozo Total</p>
              <p className="text-3xl font-black text-gradient-gold">{formatAmount(totalPool, currency)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl p-2" style={{ backgroundColor: 'rgba(230,29,37,0.1)', border: '1px solid rgba(230,29,37,0.3)' }}>
                <p className="font-black text-xs sm:text-sm break-words" style={{ color: '#E61D25' }}>{formatAmount(Math.round(totalPool * prize1Pct / 100), currency)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">1° lugar</p>
              </div>
              <div className="rounded-xl p-2" style={{ backgroundColor: 'rgba(42,57,141,0.1)', border: '1px solid rgba(42,57,141,0.3)' }}>
                <p className="font-black text-xs sm:text-sm break-words" style={{ color: '#2A398D' }}>{formatAmount(Math.round(totalPool * prize2Pct / 100), currency)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">2° lugar</p>
              </div>
              <div className="rounded-xl p-2" style={{ backgroundColor: 'rgba(60,172,59,0.1)', border: '1px solid rgba(60,172,59,0.3)' }}>
                <p className="font-black text-xs sm:text-sm break-words" style={{ color: '#3CAC3B' }}>{formatAmount(Math.round(totalPool * prize3Pct / 100), currency)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">3° lugar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Podium entries={displayEntries} showLive={showLive} showLiveGroups={showLiveGroups} />

      {/* Provisional banners */}
      {showLive && displayEntries.some(e => e.hasLiveMatches) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-900/40 bg-red-950/20">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-live-pulse shrink-0" />
          <p className="text-xs text-red-300/80 font-medium">
            Incluye puntos de partidos en juego — clasificación provisional.
          </p>
        </div>
      )}
      {showLiveGroups && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-900/40 bg-yellow-950/20">
          <span className="text-sm shrink-0">🏅</span>
          <p className="text-xs text-yellow-300/80 font-medium">
            Incluye puntos tentativos de grupos no finalizados — se confirman al cerrar cada grupo.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {displayEntries.map(entry => {
          const isMe = entry.userId === currentUserId
          const fifaColor = FIFA_COLORS[entry.rank as keyof typeof FIFA_COLORS]
          const confirmedPts = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints
          const extraPts = (showLive ? entry.livePoints : 0) + (showLiveGroups ? entry.liveGroupPoints : 0)
          const displayPts = confirmedPts + extraPts

          return (
            <Card
              key={entry.userId}
              className={`p-3 transition-all overflow-hidden relative ${
                isMe ? 'border-primary/50 bg-primary/5' : 'glass-card'
              }`}
              style={fifaColor ? {
                borderLeftWidth: 3,
                borderLeftColor: fifaColor.border,
                borderLeftStyle: 'solid',
              } : undefined}
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
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    <span title="Partidos">⚽ {entry.matchPoints + entry.pendingPoints + (showLive ? entry.livePoints : 0)}</span>
                    <span title="Grupos">🏅 {entry.groupPoints + (showLiveGroups ? entry.liveGroupPoints : 0)}</span>
                    <span title="Especiales">⭐ {entry.specialPoints}</span>
                    {entry.questionPoints > 0 && <span title="Preguntas">❓ {entry.questionPoints}</span>}
                    <span className="text-muted-foreground/60 hidden sm:inline">
                      {entry.scoredMatches}/{entry.predictedMatches} partidos
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-lg text-primary font-mono leading-none">{displayPts}</p>
                  {extraPts > 0 ? (
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
                      <span className="text-xs font-bold text-yellow-400">+{extraPts}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">pts</p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">Actualización automática cada 30s</p>
    </div>
  )
}
