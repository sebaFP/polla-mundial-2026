'use client'

import { useEffect, useState, useMemo } from 'react'
import { Match, Prediction } from '@/lib/db/schema'
import { LeaderboardEntry } from '@/app/api/pollas/[pollaId]/leaderboard/route'
import { getFlag } from '@/lib/teams'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const POLL_INTERVAL = 30_000

type Props = {
  initialMatches: Match[]
  initialPredictions: Prediction[]
  initialLeaderboard: LeaderboardEntry[]
  userId: string
  pollaId: string
}

function ScoreCard({ match, pred }: { match: Match; pred?: Prediction }) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const isFinished = match.status === 'FINISHED'

  return (
    <Card className="glass-card overflow-hidden">
      {isLive && <div className="h-0.5 w-full bg-red-500 animate-live-pulse" />}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          {isLive && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                {match.status === 'PAUSED' ? 'Entretiempo' : 'En Vivo'}
              </span>
            </div>
          )}
          {isFinished && (
            <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs">FIN</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {format(new Date(match.matchDatetime), 'HH:mm', { locale: es })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xl leading-none">{getFlag(match.team1)}</span>
            <span className="font-semibold text-sm truncate">{match.team1}</span>
          </div>

          <div className="text-center shrink-0 min-w-16">
            {(isLive || isFinished) && match.score1 !== null ? (
              <div className={`text-2xl font-black font-mono ${isLive ? 'text-primary' : 'text-foreground'}`}>
                {match.score1} – {match.score2}
              </div>
            ) : (
              <div className="text-sm font-mono text-muted-foreground">vs</div>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="font-semibold text-sm truncate text-right">{match.team2}</span>
            <span className="text-xl leading-none">{getFlag(match.team2)}</span>
          </div>
        </div>

        {pred && (
          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Tu pronóstico: <span className="font-mono font-semibold text-foreground">{pred.predictedScore1}–{pred.predictedScore2}</span>
            </span>
            {isFinished && pred.points !== null && pred.points !== undefined && (
              <span className={`text-xs font-bold ${pred.points > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                +{pred.points} pts
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function MiniLeaderboard({ entries, userId }: { entries: LeaderboardEntry[]; userId: string }) {
  const [showLive, setShowLive] = useState(true)

  if (entries.length === 0) return null
  const hasLiveData = entries.some(e => e.livePoints > 0)

  const displayEntries = useMemo(() => {
    if (showLive || !hasLiveData) return entries
    const sorted = entries.map(e => ({ ...e })).sort(
      (a, b) =>
        (b.matchPoints + b.pendingPoints + b.groupPoints + b.specialPoints + b.questionPoints) -
        (a.matchPoints + a.pendingPoints + a.groupPoints + a.specialPoints + a.questionPoints)
    )
    sorted.forEach((e, i) => { e.rank = i + 1 })
    return sorted
  }, [entries, showLive, hasLiveData])

  return (
    <div className="space-y-1.5">
      {hasLiveData && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-card/50 border border-border/40 w-fit mb-3">
          <button
            onClick={() => setShowLive(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !showLive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Confirmados
          </button>
          <button
            onClick={() => setShowLive(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showLive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
            En vivo
          </button>
        </div>
      )}
      {showLive && entries.some(e => e.hasLiveMatches) && (
        <div className="flex items-center gap-1.5 px-1 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
          <span className="text-xs text-yellow-300/70">Clasificación provisional · puntos en juego pueden cambiar</span>
        </div>
      )}
      {displayEntries.map(entry => {
        const isMe = entry.userId === userId
        const confirmedPts = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints
        const displayPts = showLive ? confirmedPts + entry.livePoints : confirmedPts
        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isMe ? 'bg-primary/10 border border-primary/30' : 'bg-card/50 border border-border/30'
            }`}
          >
            <span className="w-6 text-center text-sm font-black text-muted-foreground shrink-0">{entry.rank}</span>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback
                style={{ backgroundColor: entry.avatarColor ?? '#f59e0b', color: '#000' }}
                className="text-xs font-bold"
              >
                {entry.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 min-w-0 text-sm font-semibold truncate">
              {entry.name}
              {isMe && <span className="ml-1.5 text-xs text-primary font-normal">(tú)</span>}
            </span>
            <div className="text-right shrink-0">
              <span className="font-black text-primary font-mono text-sm leading-none">{displayPts}</span>
              {showLive && entry.livePoints > 0 ? (
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
                  <span className="text-xs font-bold text-yellow-400">+{entry.livePoints}</span>
                </div>
              ) : (
                <span className="block text-xs text-muted-foreground">pts</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LiveView({ initialMatches, initialPredictions, initialLeaderboard, userId, pollaId }: Props) {
  const [liveMatches, setLiveMatches] = useState<Match[]>(initialMatches)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    async function poll() {
      try {
        const [mRes, lRes] = await Promise.all([
          fetch(`/api/pollas/${pollaId}/matches`, { cache: 'no-store' }),
          fetch(`/api/pollas/${pollaId}/leaderboard`, { cache: 'no-store' }),
        ])
        if (mRes.ok) setLiveMatches(await mRes.json())
        if (lRes.ok) setLeaderboard(await lRes.json())
        setLastUpdated(new Date())
      } catch { /* ignore */ }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [pollaId])

  const predMap = useMemo(() => {
    const m: Record<number, Prediction> = {}
    for (const p of initialPredictions) m[p.matchId] = p
    return m
  }, [initialPredictions])

  const nowTs = Date.now()
  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  const activeMatches = useMemo(
    () => liveMatches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime()),
    [liveMatches]
  )

  const recentFinished = useMemo(
    () => liveMatches
      .filter(m => m.status === 'FINISHED' && (nowTs - new Date(m.matchDatetime).getTime()) < twentyFourHoursMs)
      .sort((a, b) => new Date(b.matchDatetime).getTime() - new Date(a.matchDatetime).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveMatches]
  )

  const hasAnything = activeMatches.length > 0 || recentFinished.length > 0

  return (
    <div className="space-y-8">

      {/* Live now */}
      {activeMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-live-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">En Vivo Ahora</h2>
          </div>
          <div className="space-y-3">
            {activeMatches.map(m => (
              <ScoreCard key={m.id} match={m} pred={predMap[m.id]} />
            ))}
          </div>
        </section>
      )}

      {/* Today / recent finished */}
      {recentFinished.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Resultados recientes</h2>
          <div className="space-y-3">
            {recentFinished.map(m => (
              <ScoreCard key={m.id} match={m} pred={predMap[m.id]} />
            ))}
          </div>
        </section>
      )}

      {/* Nothing happening */}
      {!hasAnything && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">⚽</p>
          <p className="font-semibold text-muted-foreground">No hay partidos en este momento</p>
          <p className="text-xs text-muted-foreground/60">Esta página se actualiza automáticamente cada 30s</p>
        </div>
      )}

      {/* Leaderboard */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Clasificación</h2>
            {leaderboard.some(e => e.hasLiveMatches) && (
              <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400/80">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
                en vivo
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground/60">
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
        </div>
        <MiniLeaderboard entries={leaderboard} userId={userId} />
      </section>

      <p className="text-center text-xs text-muted-foreground/50">
        Actualización automática cada 30s
      </p>
    </div>
  )
}
