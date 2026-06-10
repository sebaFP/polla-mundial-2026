'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { parseExcelPredictions, type ParsedExcel } from '@/lib/excel-parser'

type Member = { id: string; name: string }

type Props = {
  pollaId: string
  isAdmin?: boolean
  members?: Member[]
}

export default function ImportPredictionsButton({ pollaId, isAdmin, members }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [parsed, setParsed] = useState<ParsedExcel | null>(null)
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  function handleClick() {
    fileRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const buffer = await file.arrayBuffer()
      const result = parseExcelPredictions(buffer)
      setParsed(result)
      setTargetUserId('')
      setOpen(true)
    } catch (err) {
      toast.error(`No se pudo leer la planilla: ${String(err)}`)
    }
  }

  async function handleImport() {
    if (!parsed) return
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        matchPredictions: parsed.matchPredictions,
        groupPredictions: parsed.groupPredictions,
        bonusPredictions: parsed.bonusPredictions,
      }
      if (isAdmin && targetUserId) {
        body.targetUserId = targetUserId
      }

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
      setParsed(null)
      toast.success(`Importados ${data.imported} pronósticos${data.skipped > 0 ? ` (${data.skipped} omitidos por cierre)` : ''}`)
      router.refresh()
    } catch {
      toast.error('Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const total = parsed
    ? parsed.matchPredictions.length + parsed.groupPredictions.length + parsed.bonusPredictions.length
    : 0

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="outline" size="sm" onClick={handleClick} className="text-xs gap-1.5">
        <span>📥</span>
        Importar planilla
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar pronósticos desde planilla</DialogTitle>
          </DialogHeader>

          {parsed && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <p className="font-medium text-foreground">Encontrado en la planilla:</p>
                <div className="space-y-1 text-muted-foreground">
                  {parsed.matchPredictions.length > 0 && (
                    <p>⚽ {parsed.matchPredictions.length} pronósticos de partidos</p>
                  )}
                  {parsed.groupPredictions.length > 0 && (
                    <p>🏅 {parsed.groupPredictions.length} grupos (1°, 2°, 3° lugar)</p>
                  )}
                  {parsed.bonusPredictions.length > 0 && (
                    <p>🎯 {parsed.bonusPredictions.length} preguntas bonus</p>
                  )}
                  {total === 0 && (
                    <p className="text-destructive">No se encontraron pronósticos en la planilla.</p>
                  )}
                </div>
              </div>

              {parsed.unmatchedTeams.length > 0 && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-yellow-400">
                    ⚠️ Estos nombres de país no se reconocieron y serán omitidos:
                  </p>
                  <ul className="text-xs text-yellow-300 space-y-0.5 pl-2">
                    {parsed.unmatchedTeams.map(t => (
                      <li key={t}>• {t}</li>
                    ))}
                  </ul>
                </div>
              )}

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
            <Button
              size="sm"
              onClick={handleImport}
              disabled={loading || total === 0}
            >
              {loading ? 'Importando...' : `Importar ${total} pronósticos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
