'use client'

import { useRef, useState } from 'react'
import { parsePredictionTemplate } from '@/lib/excel-template-parser'
import { parseExcelPredictions } from '@/lib/excel-parser'

type Participant = { userId: string; name: string }

type FileEntry = {
  id: string
  file: File
  userId: string
  format: 'v2' | 'legacy' | 'invalid'
  predCount: number
  parsedBody: Record<string, unknown> | null
  status: 'pending' | 'running' | 'done' | 'error'
  result?: { imported: number; skipped: number; errors: string[] }
  errorMsg?: string
}

type Props = {
  pollaId: string
  participants: Participant[]
}

function formatBadge(format: FileEntry['format']) {
  if (format === 'v2') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-700/40">Oficial</span>
  if (format === 'legacy') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700/40">Legado</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-700/40">Inválido</span>
}

function statusBadge(entry: FileEntry) {
  if (entry.status === 'pending') return <span className="text-xs text-muted-foreground">Esperando</span>
  if (entry.status === 'running') return <span className="text-xs text-blue-400 animate-pulse">Importando…</span>
  if (entry.status === 'error') return <span className="text-xs text-red-400">{entry.errorMsg ?? 'Error'}</span>
  const r = entry.result!
  return (
    <span className="text-xs text-emerald-400">
      ✓ {r.imported} importados{r.skipped > 0 ? `, ${r.skipped} omitidos` : ''}
      {r.errors.length > 0 ? <span className="text-red-400 ml-1">({r.errors.length} errores)</span> : null}
    </span>
  )
}

export default function BulkImportPanel({ pollaId, participants }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [running, setRunning] = useState(false)

  const done = entries.filter(e => e.status === 'done').length
  const total = entries.length
  const allDone = total > 0 && done === total

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const parsed: FileEntry[] = await Promise.all(files.map(async (file, i) => {
      const id = `${Date.now()}-${i}`
      try {
        const buffer = await file.arrayBuffer()
        const v2 = parsePredictionTemplate(buffer)
        if (v2.errors.length === 0) {
          return {
            id, file, userId: '', format: 'v2' as const,
            predCount: v2.matchPredictions.length + v2.groupPredictions.length + v2.specialPredictions.length + v2.bonusPredictions.length + v2.questionAnswers.length,
            parsedBody: {
              matchPredictions: v2.matchPredictions,
              groupPredictions: v2.groupPredictions,
              specialPredictions: v2.specialPredictions,
              bonusPredictions: v2.bonusPredictions,
              questionAnswers: v2.questionAnswers,
            },
            status: 'pending' as const,
          }
        }
        const legacy = parseExcelPredictions(buffer)
        const hasData = legacy.matchPredictions.length > 0 || legacy.groupPredictions.length > 0 || legacy.bonusPredictions.length > 0
        if (hasData) {
          return {
            id, file, userId: '', format: 'legacy' as const,
            predCount: legacy.matchPredictions.length + legacy.groupPredictions.length + legacy.bonusPredictions.length,
            parsedBody: {
              legacy: true,
              matchPredictions: legacy.matchPredictions,
              groupPredictions: legacy.groupPredictions,
              bonusPredictions: legacy.bonusPredictions,
            },
            status: 'pending' as const,
          }
        }
      } catch { /* fall through */ }
      return { id, file, userId: '', format: 'invalid' as const, predCount: 0, parsedBody: null, status: 'pending' as const }
    }))

    setEntries(prev => [...prev, ...parsed])
  }

  async function handleRun() {
    const toRun = entries.filter(e => e.status === 'pending' && e.format !== 'invalid' && e.userId)
    if (toRun.length === 0) return
    setRunning(true)
    for (const entry of toRun) {
      updateEntry(entry.id, { status: 'running' })
      try {
        const body = { ...entry.parsedBody, targetUserId: entry.userId }
        const res = await fetch(`/api/pollas/${pollaId}/import-predictions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) {
          updateEntry(entry.id, { status: 'error', errorMsg: data.error ?? 'Error' })
        } else {
          updateEntry(entry.id, { status: 'done', result: data })
        }
      } catch (err) {
        updateEntry(entry.id, { status: 'error', errorMsg: String(err) })
      }
    }
    setRunning(false)
  }

  const pendingValid = entries.filter(e => e.status === 'pending' && e.format !== 'invalid' && e.userId).length
  const unassigned = entries.filter(e => e.status === 'pending' && e.format !== 'invalid' && !e.userId).length

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm">Importación masiva de planillas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Carga múltiples planillas y asígnalas a cada participante</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors shrink-0"
        >
          + Agregar planillas
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" multiple className="hidden" onChange={handleFiles} />
      </div>

      {entries.length > 0 && (
        <>
          {/* Progress bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{done} / {total} completados</span>
                {unassigned > 0 && <span className="text-yellow-400">{unassigned} sin asignar</span>}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {/* File table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium">Archivo</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Formato</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Pronósticos</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Participante</th>
                  <th className="text-left py-1.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-border/20 last:border-0">
                    <td className="py-2 pr-3 max-w-[160px] truncate text-muted-foreground" title={entry.file.name}>
                      {entry.file.name}
                    </td>
                    <td className="py-2 pr-3">{formatBadge(entry.format)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {entry.format !== 'invalid' ? entry.predCount : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {entry.status === 'pending' ? (
                        <select
                          value={entry.userId}
                          onChange={e => updateEntry(entry.id, { userId: e.target.value })}
                          className="rounded border border-border bg-background px-2 py-1 text-xs w-full max-w-[180px]"
                          disabled={entry.format === 'invalid'}
                        >
                          <option value="">— Seleccionar —</option>
                          {participants.map(p => (
                            <option key={p.userId} value={p.userId}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">
                          {participants.find(p => p.userId === entry.userId)?.name ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{statusBadge(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleRun}
              disabled={running || pendingValid === 0}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {running ? 'Importando…' : `Importar ${pendingValid} planilla${pendingValid !== 1 ? 's' : ''}`}
            </button>
            {allDone && (
              <button
                onClick={() => setEntries([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpiar
              </button>
            )}
            {!running && entries.some(e => e.status === 'pending') && (
              <button
                onClick={() => setEntries(prev => prev.filter(e => e.status !== 'pending'))}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Quitar pendientes
              </button>
            )}
          </div>
        </>
      )}

      {entries.length === 0 && (
        <div
          className="border-2 border-dashed border-border/40 rounded-lg py-8 text-center text-sm text-muted-foreground cursor-pointer hover:border-border/70 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          Arrastra planillas aquí o haz clic para seleccionar
        </div>
      )}
    </div>
  )
}
