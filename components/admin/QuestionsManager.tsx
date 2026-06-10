'use client'

import { useState } from 'react'
import { PollaQuestion, PollaQuestionOption } from '@/lib/db/schema'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getFlag } from '@/lib/teams'
import { toast } from 'sonner'

type QuestionWithOptions = PollaQuestion & { options: PollaQuestionOption[] }

type Props = {
  initialQuestions: QuestionWithOptions[]
  pollaId: string
  allTeams: string[]
}

const TYPE_LABELS: Record<string, string> = {
  team: '🏳️ Selección',
  player: '👤 Jugador',
  range: '📊 Rango',
}

type NewOption = { label: string; points: number }

type ResultState = {
  correctAnswer: string
  correctOptionId: string
  teamSearch: string
}

export default function QuestionsManager({ initialQuestions, pollaId, allTeams }: Props) {
  const [questions, setQuestions] = useState<QuestionWithOptions[]>(initialQuestions)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resultState, setResultState] = useState<Record<string, ResultState>>({})
  const [teamSearch, setTeamSearch] = useState('')

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<'team' | 'player' | 'range'>('team')
  const [newPoints, setNewPoints] = useState(5)
  const [newOptions, setNewOptions] = useState<NewOption[]>([
    { label: '', points: 3 },
    { label: '', points: 3 },
    { label: '', points: 3 },
  ])

  async function createQuestion() {
    if (!newTitle.trim()) { toast.error('Ingresa un título'); return }
    if (newType === 'range' && newOptions.filter(o => o.label.trim()).length < 2) {
      toast.error('Agrega al menos 2 opciones'); return
    }
    setSaving('create')
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          type: newType,
          pointsValue: newType !== 'range' ? newPoints : undefined,
          options: newType === 'range' ? newOptions.filter(o => o.label.trim()) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setQuestions(prev => [...prev, data])
      setNewTitle(''); setNewDesc(''); setNewType('team'); setNewPoints(5)
      setNewOptions([{ label: '', points: 3 }, { label: '', points: 3 }, { label: '', points: 3 }])
      setShowCreate(false)
      toast.success('Pregunta creada')
    } catch { toast.error('Error al crear') }
    finally { setSaving(null) }
  }

  async function toggleEnabled(q: QuestionWithOptions) {
    setSaving(q.id)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/questions/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !q.enabled }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...data, options: x.options } : x))
    } catch { toast.error('Error') }
    finally { setSaving(null) }
  }

  async function deleteQuestion(q: QuestionWithOptions) {
    if (!confirm(`¿Eliminar "${q.title}"? Se perderán todas las respuestas.`)) return
    setSaving(q.id + '-del')
    try {
      const res = await fetch(`/api/pollas/${pollaId}/admin/questions/${q.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Error al eliminar'); return }
      setQuestions(prev => prev.filter(x => x.id !== q.id))
      toast.success('Pregunta eliminada')
    } catch { toast.error('Error') }
    finally { setSaving(null) }
  }

  async function addOption(q: QuestionWithOptions, label: string, points: number) {
    const res = await fetch(`/api/pollas/${pollaId}/admin/questions/${q.id}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, points }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, options: [...x.options, data] } : x))
  }

  async function deleteOption(q: QuestionWithOptions, optId: string) {
    const res = await fetch(`/api/pollas/${pollaId}/admin/questions/${q.id}/options/${optId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error'); return }
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, options: x.options.filter(o => o.id !== optId) } : x))
  }

  async function setResult(q: QuestionWithOptions) {
    const rs = resultState[q.id]
    if (!rs) return
    setSaving(q.id + '-result')
    try {
      const body = q.type === 'range'
        ? { correctOptionId: rs.correctOptionId }
        : { correctAnswer: rs.correctAnswer }

      if (q.type === 'range' && !rs.correctOptionId) { toast.error('Selecciona la opción correcta'); return }
      if (q.type !== 'range' && !rs.correctAnswer?.trim()) { toast.error('Ingresa la respuesta correcta'); return }

      const res = await fetch(`/api/pollas/${pollaId}/admin/questions/${q.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }

      // Update local state
      if (q.type === 'range') {
        setQuestions(prev => prev.map(x => x.id === q.id
          ? { ...x, options: x.options.map(o => ({ ...o, isCorrect: o.id === rs.correctOptionId })) }
          : x
        ))
      } else {
        setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, correctAnswer: rs.correctAnswer } : x))
      }
      toast.success('Resultado guardado — puntos recalculados')
    } catch { toast.error('Error') }
    finally { setSaving(null) }
  }

  const filteredTeams = allTeams.filter(t => t.toLowerCase().includes(teamSearch.toLowerCase()))

  return (
    <div className="space-y-4">
      {/* Question list */}
      {questions.length === 0 && !showCreate && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No hay preguntas creadas todavía.
        </div>
      )}

      {questions.map(q => (
        <Card key={q.id} className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs shrink-0">{TYPE_LABELS[q.type]}</Badge>
                  {q.type !== 'range' && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs shrink-0">+{q.pointsValue} pts</Badge>
                  )}
                  {!q.enabled && <Badge variant="secondary" className="text-xs">Desactivada</Badge>}
                </div>
                <CardTitle className="text-sm mt-1">{q.title}</CardTitle>
                {q.description && <CardDescription className="text-xs">{q.description}</CardDescription>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={q.enabled}
                  onCheckedChange={() => toggleEnabled(q)}
                  disabled={saving === q.id}
                />
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                >
                  {expandedId === q.id ? 'Cerrar' : 'Gestionar'}
                </button>
                <button
                  onClick={() => deleteQuestion(q)}
                  disabled={saving === q.id + '-del'}
                  className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded border border-destructive/30"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </CardHeader>

          {expandedId === q.id && (
            <CardContent className="space-y-4 pt-0">
              {/* Options for range questions */}
              {q.type === 'range' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Opciones</p>
                  {q.options.map(opt => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm px-2 py-1 rounded bg-card border border-border">{opt.label}</span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">+{opt.points} pts</Badge>
                      {opt.isCorrect && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Correcta</Badge>}
                      <button
                        onClick={() => deleteOption(q, opt.id)}
                        className="text-xs text-destructive hover:text-destructive/80 px-1"
                      >✕</button>
                    </div>
                  ))}
                  <AddOptionRow onAdd={(label, pts) => addOption(q, label, pts)} />
                </div>
              )}

              {/* Set result */}
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Establecer Resultado</p>
                {q.type === 'range' ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {q.options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setResultState(prev => ({ ...prev, [q.id]: { ...prev[q.id], correctOptionId: opt.id, correctAnswer: '', teamSearch: '' } }))}
                        className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-colors text-left border ${
                          resultState[q.id]?.correctOptionId === opt.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:border-primary'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-xs opacity-70">+{opt.points} pts</span>
                      </button>
                    ))}
                  </div>
                ) : q.type === 'team' ? (
                  <div className="space-y-2">
                    {(q.correctAnswer || resultState[q.id]?.correctAnswer) && (
                      <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30">
                        <span className="text-lg">{getFlag(resultState[q.id]?.correctAnswer || q.correctAnswer || '')}</span>
                        <span className="text-sm font-medium">{resultState[q.id]?.correctAnswer || q.correctAnswer}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Buscar equipo..."
                      value={resultState[q.id]?.teamSearch ?? ''}
                      onChange={e => setResultState(prev => ({ ...prev, [q.id]: { ...prev[q.id], teamSearch: e.target.value, correctAnswer: prev[q.id]?.correctAnswer ?? '', correctOptionId: '' } }))}
                      className="w-full px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                      {allTeams.filter(t => t.toLowerCase().includes((resultState[q.id]?.teamSearch ?? '').toLowerCase())).map(team => (
                        <button
                          key={team}
                          onClick={() => setResultState(prev => ({ ...prev, [q.id]: { ...prev[q.id], correctAnswer: team, teamSearch: team, correctOptionId: '' } }))}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-left ${
                            resultState[q.id]?.correctAnswer === team
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-border hover:border-primary'
                          }`}
                        >
                          <span>{getFlag(team)}</span>
                          <span className="truncate">{team}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: Mbappé"
                    value={resultState[q.id]?.correctAnswer ?? q.correctAnswer ?? ''}
                    onChange={e => setResultState(prev => ({ ...prev, [q.id]: { ...prev[q.id], correctAnswer: e.target.value, correctOptionId: '', teamSearch: '' } }))}
                    className="w-full px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                )}

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setResult(q)}
                  disabled={saving === q.id + '-result'}
                >
                  {saving === q.id + '-result' ? 'Guardando...' : 'Guardar resultado y recalcular puntos'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Create question form */}
      {showCreate ? (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nueva Pregunta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Pregunta *</Label>
              <input
                type="text"
                placeholder="¿Cuál equipo...?"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <input
                type="text"
                placeholder="Descripción adicional"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de respuesta</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['team', 'player', 'range'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors text-center border ${
                      newType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {newType !== 'range' ? (
              <div className="space-y-1">
                <Label className="text-xs">Puntos por respuesta correcta</Label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={newPoints}
                  onChange={e => setNewPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Opciones (label + puntos)</Label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder={`Opción ${i + 1}`}
                      value={opt.label}
                      onChange={e => setNewOptions(prev => prev.map((o, j) => j === i ? { ...o, label: e.target.value } : o))}
                      className="flex-1 px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={opt.points}
                      onChange={e => setNewOptions(prev => prev.map((o, j) => j === i ? { ...o, points: Number(e.target.value) } : o))}
                      className="w-16 px-2 py-1.5 text-sm rounded-md bg-input border border-border text-foreground focus:border-primary focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                    {newOptions.length > 2 && (
                      <button onClick={() => setNewOptions(prev => prev.filter((_, j) => j !== i))} className="text-destructive text-xs">✕</button>
                    )}
                  </div>
                ))}
                {newOptions.length < 6 && (
                  <button
                    onClick={() => setNewOptions(prev => [...prev, { label: '', points: 3 }])}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    + Agregar opción
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={createQuestion} disabled={saving === 'create'} className="flex-1">
                {saving === 'create' ? 'Creando...' : 'Crear pregunta'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowCreate(true)} className="w-full" variant="outline">
          + Nueva Pregunta
        </Button>
      )}
    </div>
  )
}

function AddOptionRow({ onAdd }: { onAdd: (label: string, points: number) => void }) {
  const [label, setLabel] = useState('')
  const [points, setPoints] = useState(3)

  function submit() {
    if (!label.trim()) return
    onAdd(label, points)
    setLabel('')
    setPoints(3)
  }

  return (
    <div className="flex gap-2 items-center pt-1">
      <input
        type="text"
        placeholder="Nueva opción"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        className="flex-1 px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <input
        type="number"
        min={0}
        max={50}
        value={points}
        onChange={e => setPoints(Number(e.target.value))}
        className="w-16 px-2 py-1.5 text-sm rounded-md bg-input border border-border text-foreground focus:border-primary focus:outline-none"
      />
      <span className="text-xs text-muted-foreground">pts</span>
      <button onClick={submit} className="text-xs text-primary hover:text-primary/80 px-2 py-1 border border-primary/30 rounded">+ Agregar</button>
    </div>
  )
}
