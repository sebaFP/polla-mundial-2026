'use client'

import { useState } from 'react'
import { PollaQuestion, PollaQuestionOption, PollaAnswer } from '@/lib/db/schema'
import { getFlag } from '@/lib/teams'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type QuestionWithData = PollaQuestion & {
  options: PollaQuestionOption[]
  myAnswer: PollaAnswer | null
}

type Props = {
  questions: QuestionWithData[]
  pollaId: string
  teams: string[]
}

type AnswerState = {
  answer: string
  optionId: string
  saved: boolean
  points?: number | null
}

export default function CustomQuestionsForm({ questions, pollaId, teams }: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const map: Record<string, AnswerState> = {}
    for (const q of questions) {
      if (!q.myAnswer) continue
      map[q.id] = {
        answer: q.myAnswer.answer ?? '',
        optionId: q.myAnswer.optionId ?? '',
        saved: true,
        points: q.myAnswer.points,
      }
    }
    return map
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredTeams = teams.filter(t => t.toLowerCase().includes(search.toLowerCase()))

  async function saveAnswer(q: QuestionWithData) {
    const state = answers[q.id]
    if (!state) { toast.error('Selecciona una respuesta'); return }
    if (q.type === 'range' && !state.optionId) { toast.error('Selecciona una opción'); return }
    if (q.type !== 'range' && !state.answer?.trim()) { toast.error('Ingresa una respuesta'); return }

    setSaving(q.id)
    try {
      const res = await fetch(`/api/pollas/${pollaId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: q.id,
          answer: q.type !== 'range' ? state.answer.trim() : undefined,
          optionId: q.type === 'range' ? state.optionId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], saved: true } }))
      toast.success('¡Respuesta guardada!')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function setTeamAnswer(qId: string, team: string) {
    setAnswers(prev => ({ ...prev, [qId]: { answer: team, optionId: '', saved: false } }))
  }

  function setTextAnswer(qId: string, value: string) {
    setAnswers(prev => ({ ...prev, [qId]: { ...(prev[qId] ?? { optionId: '', saved: false }), answer: value, saved: false } }))
  }

  function setRangeAnswer(qId: string, optionId: string) {
    setAnswers(prev => ({ ...prev, [qId]: { answer: '', optionId, saved: false } }))
  }

  return (
    <div className="space-y-4">
      {questions.map(q => {
        const state = answers[q.id]
        const savedOption = q.type === 'range' ? q.options.find(o => o.id === state?.optionId) : null
        const correctOption = q.options.find(o => o.isCorrect)

        return (
          <Card key={q.id} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{q.title}</CardTitle>
                  {q.description && <CardDescription className="text-xs">{q.description}</CardDescription>}
                </div>
                {q.type !== 'range' && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0">+{q.pointsValue} pts</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Show saved answer */}
              {state?.saved && state.answer && q.type !== 'range' && (
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                  {q.type === 'team' && <span className="text-xl">{getFlag(state.answer)}</span>}
                  <span className="font-semibold">{state.answer}</span>
                  {state.points !== undefined && state.points !== null && (
                    <Badge className="ml-auto" variant={state.points > 0 ? 'default' : 'secondary'}>
                      +{state.points} pts
                    </Badge>
                  )}
                </div>
              )}
              {state?.saved && savedOption && q.type === 'range' && (
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                  <span className="font-semibold">{savedOption.label}</span>
                  <div className="flex items-center gap-2">
                    {correctOption && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Correcta: {correctOption.label}</Badge>}
                    {state.points !== undefined && state.points !== null && (
                      <Badge variant={state.points > 0 ? 'default' : 'secondary'}>+{state.points} pts</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Input */}
              {q.type === 'team' && (
                <>
                  <input
                    type="text"
                    placeholder="Buscar equipo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                    {filteredTeams.map(team => (
                      <button
                        key={team}
                        onClick={() => setTeamAnswer(q.id, team)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                          state?.answer === team
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'bg-card border border-border hover:border-primary'
                        }`}
                      >
                        <span>{getFlag(team)}</span>
                        <span className="truncate">{team}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {q.type === 'player' && (
                <input
                  type="text"
                  placeholder="Ej: Mbappé, Messi, Vinicius Jr..."
                  value={state?.answer ?? ''}
                  onChange={e => setTextAnswer(q.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              )}

              {q.type === 'range' && (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(q.options.length, 3)}, 1fr)` }}>
                  {q.options.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setRangeAnswer(q.id, opt.id)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors text-center border ${
                        state?.optionId === opt.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">+{opt.points} pts</div>
                    </button>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                className="w-full"
                variant={state?.saved ? 'outline' : 'default'}
                onClick={() => saveAnswer(q)}
                disabled={saving === q.id || (!state?.answer?.trim() && !state?.optionId)}
              >
                {saving === q.id ? 'Guardando...' : state?.saved ? '✓ Guardado' : 'Guardar'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
