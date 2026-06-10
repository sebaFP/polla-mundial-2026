'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { parsePredictionTemplate, type ParsedTemplate } from '@/lib/excel-template-parser'
import { parseExcelPredictions, type ParsedExcel } from '@/lib/excel-parser'

type Member = { id: string; name: string }

type Props = {
  pollaId: string
  isAdmin?: boolean
  members?: Member[]
}

type ParseResult =
  | { format: 'v2'; data: ParsedTemplate }
  | { format: 'legacy'; data: ParsedExcel }

export default function ImportPredictionsButton({ pollaId, isAdmin, members }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  function handleClickImport() {
    fileRef.current?.click()
  }

  function handleDownload() {
    window.location.href = `/api/pollas/${pollaId}/template`
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const buffer = await file.arrayBuffer()

      // Try new official format first
      const v2 = parsePredictionTemplate(buffer)
      if (v2.errors.length === 0) {
        setResult({ format: 'v2', data: v2 })
        setTargetUserId('')
        setOpen(true)
        return
      }

      // Fall back to legacy Copa Mundial FIFA 2026 format
      try {
        const legacy = parseExcelPredictions(buffer)
        const hasData = legacy.matchPredictions.length > 0
          || legacy.groupPredictions.length > 0
          || legacy.bonusPredictions.length > 0
        if (hasData) {
          setResult({ format: 'legacy', data: legacy })
          setTargetUserId('')
          setOpen(true)
          return
        }
      } catch { /* fall through */ }

      toast.error(v2.errors[0])
    } catch (err) {
      toast.error(`No se pudo leer la planilla: ${String(err)}`)
    }
  }

  async function handleImport() {
    if (!result) return
    setLoading(true)
    try {
      let body: Record<string, unknown>

      if (result.format === 'v2') {
        const d = result.data
        body = {
          matchPredictions: d.matchPredictions,
          groupPredictions: d.groupPredictions,
          specialPredictions: d.specialPredictions,
          bonusPredictions: d.bonusPredictions,
          questionAnswers: d.questionAnswers,
        }
      } else {
        const d = result.data
        body = {
          legacy: true,
          matchPredictions: d.matchPredictions,
          groupPredictions: d.groupPredictions,
          bonusPredictions: d.bonusPredictions,
        }
      }

      if (isAdmin && targetUserId) body.targetUserId = targetUserId

      const res = await fetch(`/api/pollas/${pollaId}/import-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al importar')
        return
      }
      setOpen(false)
      setResult(null)
      toast.success(
        `Importados ${data.imported} pronósticos${data.skipped > 0 ? ` (${data.skipped} omitidos)` : ''}`
      )
      router.refresh()
    } catch {
      toast.error('Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const total = result
    ? result.format === 'v2'
      ? result.data.matchPredictions.length
        + result.data.groupPredictions.length
        + result.data.specialPredictions.length
        + result.data.bonusPredictions.length
        + result.data.questionAnswers.length
      : result.data.matchPredictions.length
        + result.data.groupPredictions.length
        + result.data.bonusPredictions.length
    : 0

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload} className="text-xs gap-1.5">
          <span>📥</span>
          Descargar planilla
        </Button>
        <Button variant="outline" size="sm" onClick={handleClickImport} className="text-xs gap-1.5">
          <span>📤</span>
          Importar planilla
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar pronósticos desde planilla</DialogTitle>
          </DialogHeader>

          {result && (
            <div className="space-y-4 text-sm">
              {result.format === 'legacy' && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-400">
                  ⚠️ <strong>Formato legado</strong> — planilla Copa Mundial FIFA 2026. Solo partidos, grupos y preguntas bonus.
                  Para futuras importaciones descarga la planilla oficial.
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <p className="font-medium text-foreground">Encontrado en la planilla:</p>
                <div className="space-y-1 text-muted-foreground">
                  {result.format === 'v2' ? (
                    <>
                      {result.data.matchPredictions.length > 0 && (
                        <p>⚽ {result.data.matchPredictions.length} pronósticos de partidos</p>
                      )}
                      {result.data.groupPredictions.length > 0 && (
                        <p>🏅 {result.data.groupPredictions.length} clasificados de grupo</p>
                      )}
                      {result.data.specialPredictions.length > 0 && (
                        <p>🏆 {result.data.specialPredictions.length} predicciones especiales</p>
                      )}
                      {result.data.bonusPredictions.length > 0 && (
                        <p>🎯 {result.data.bonusPredictions.length} preguntas bonus / premios</p>
                      )}
                      {result.data.questionAnswers.length > 0 && (
                        <p>❓ {result.data.questionAnswers.length} preguntas personalizadas</p>
                      )}
                    </>
                  ) : (
                    <>
                      {result.data.matchPredictions.length > 0 && (
                        <p>⚽ {result.data.matchPredictions.length} pronósticos de partidos</p>
                      )}
                      {result.data.groupPredictions.length > 0 && (
                        <p>🏅 {result.data.groupPredictions.length} grupos (1°, 2°, 3° lugar)</p>
                      )}
                      {result.data.bonusPredictions.length > 0 && (
                        <p>🎯 {result.data.bonusPredictions.length} preguntas bonus</p>
                      )}
                      {result.data.unmatchedTeams.length > 0 && (
                        <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-2 space-y-0.5">
                          <p className="text-xs font-medium text-yellow-400">Países no reconocidos (serán omitidos):</p>
                          {result.data.unmatchedTeams.map(t => (
                            <p key={t} className="text-xs text-yellow-300">• {t}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {total === 0 && (
                    <p className="text-destructive">No se encontraron pronósticos en la planilla.</p>
                  )}
                </div>
              </div>

              {isAdmin && members && members.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Importar para:</p>
                  <select
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Mi cuenta (admin)</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Los pronósticos existentes serán sobreescritos. Los partidos ya cerrados serán omitidos.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleImport} disabled={loading || total === 0}>
              {loading ? 'Importando...' : `Importar ${total} pronósticos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
