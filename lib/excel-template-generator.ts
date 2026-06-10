import * as XLSX from 'xlsx'
import type { Config } from './scoring'
import { getRangeOptions, getConfigValue } from './scoring'
import type { PollaQuestion, PollaQuestionOption } from './db/schema'
import { matches as matchesTable } from './db/schema'

type Match = typeof matchesTable.$inferSelect

const STAGE_SHEET_NAMES: Record<string, string> = {
  LAST_32: 'Ronda 32',
  LAST_16: 'Octavos',
  QUARTER_FINALS: 'Cuartos',
  SEMI_FINALS: 'Semis',
  THIRD_PLACE: 'Tercer Lugar',
  FINAL: 'Final',
}
const STAGE_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']

const COL_WIDTHS = [
  { wch: 14 },  // A: key/id
  { wch: 38 },  // B: label/teams
  { wch: 10 },  // C: score1/answer
  { wch: 4 },   // D: separator or short hint
  { wch: 10 },  // E: score2
  { wch: 50 },  // F: date/options hint
]

function fmtDate(d: Date): string {
  try {
    return d.toLocaleDateString('es-CL', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Santiago',
    })
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}

function makeSheet(rows: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = COL_WIDTHS
  return ws
}

export function generatePredictionTemplate(params: {
  pollaName: string
  config: Config
  matches: Match[]
  questions: PollaQuestion[]
  questionOptions: PollaQuestionOption[]
}): Uint8Array {
  const { pollaName, config, matches, questions, questionOptions } = params
  const wb = XLSX.utils.book_new()

  // ── Info sheet ──────────────────────────────────────────────────────────────
  const infoWs = XLSX.utils.aoa_to_sheet([
    ['VERSION', 'POLLA_TEMPLATE_V2'],
    [],
    ['POLLA:', pollaName],
    ['GENERADA:', fmtDate(new Date())],
    [],
    ['INSTRUCCIONES'],
    ['1. Completa las celdas en blanco con tus pronósticos'],
    ['2. Partidos: escribe el número de goles en "Gol Local" y "Gol Visitante"'],
    ['3. Clasificados: escribe el nombre exacto del equipo'],
    ['4. Especiales/Bonus: escribe el nombre exacto del equipo o jugador'],
    ['5. Para preguntas de rango: copia exactamente una de las opciones indicadas'],
    ['6. Guarda el archivo y súbelo con el botón "Importar planilla"'],
    [],
    ['IMPORTANTE: No modifiques la columna A (claves internas)'],
  ])
  infoWs['!cols'] = [{ wch: 12 }, { wch: 55 }]
  XLSX.utils.book_append_sheet(wb, infoWs, 'Info')

  // ── Group sheets ─────────────────────────────────────────────────────────────
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  for (const g of groups) {
    const groupName = `GROUP_${g}`
    const groupMatches = matches
      .filter(m => m.stage === 'GROUP_STAGE' && m.groupName === groupName)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())

    if (groupMatches.length === 0) continue

    const rows: unknown[][] = [
      [`GRUPO ${g}`],
      ['clave', 'Partido', 'Gol Local', '', 'Gol Visitante', 'Fecha'],
    ]
    for (const m of groupMatches) {
      rows.push([m.id, `${m.team1} vs ${m.team2}`, '', '-', '', fmtDate(new Date(m.matchDatetime))])
    }
    rows.push([])
    rows.push(['CLASIFICADOS'])
    rows.push([`${groupName}_FIRST`, '1° Lugar', ''])
    rows.push([`${groupName}_SECOND`, '2° Lugar', ''])
    rows.push([`${groupName}_THIRD`, '3° Lugar', ''])

    XLSX.utils.book_append_sheet(wb, makeSheet(rows), `Grupo ${g}`)
  }

  // ── Knockout sheets ───────────────────────────────────────────────────────────
  for (const stage of STAGE_ORDER) {
    const stageMatches = matches
      .filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime())
    if (stageMatches.length === 0) continue

    const sheetName = STAGE_SHEET_NAMES[stage]
    const rows: unknown[][] = [
      [sheetName.toUpperCase()],
      ['clave', 'Partido', 'Gol Local', '', 'Gol Visitante', 'Fecha'],
    ]
    for (const m of stageMatches) {
      rows.push([m.id, `${m.team1} vs ${m.team2}`, '', '-', '', fmtDate(new Date(m.matchDatetime))])
    }
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), sheetName)
  }

  // ── Especiales sheet ──────────────────────────────────────────────────────────
  if (config.feature_special_predictions === 'true') {
    const rows: unknown[][] = [
      ['PREDICCIONES ESPECIALES'],
      ['clave', 'Predicción', 'Tu respuesta', '', '', 'Tipo / Puntos'],
      ['champion', 'Campeón del Mundo', '', '', '', `(equipo) — ${getConfigValue(config, 'points_champion', 20)} pts`],
      ['finalist', 'Finalista (perdedor)', '', '', '', `(equipo) — ${getConfigValue(config, 'points_finalist', 10)} pts`],
      ['third', '3° Lugar', '', '', '', `(equipo) — ${getConfigValue(config, 'points_third_place', 8)} pts`],
    ]
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), 'Especiales')
  }

  // ── Premios sheet (player awards) ─────────────────────────────────────────────
  if (config.feature_bonus_predictions === 'true') {
    const playerAwards = [
      { key: 'top_scorer', label: 'Goleador del Torneo', featureKey: 'feature_top_scorer', pointsKey: 'points_top_scorer', defaultPts: 15 },
      { key: 'best_goalkeeper', label: 'Mejor Arquero', featureKey: 'feature_best_goalkeeper', pointsKey: 'points_best_goalkeeper', defaultPts: 15 },
      { key: 'best_player', label: 'Mejor Jugador (Balón de Oro)', featureKey: 'feature_best_player', pointsKey: 'points_best_player', defaultPts: 15 },
    ].filter(a => config[a.featureKey] === 'true')

    if (playerAwards.length > 0) {
      const rows: unknown[][] = [
        ['PREMIOS INDIVIDUALES'],
        ['clave', 'Pregunta', 'Tu respuesta', '', '', 'Tipo / Puntos'],
        ...playerAwards.map(a => [
          a.key, a.label, '', '', '',
          `(nombre del jugador) — ${getConfigValue(config, a.pointsKey, a.defaultPts)} pts`,
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, makeSheet(rows), 'Premios')
    }

    // ── Bonus sheet (team + range) ──────────────────────────────────────────────
    const bonusTeam = [
      { key: 'bonus_most_goals_team', label: 'Selección más goleadora', featureKey: 'feature_bonus_most_goals_team', pointsKey: 'points_bonus_most_goals_team', defaultPts: 5 },
      { key: 'bonus_most_conceded_team', label: 'Selección más goleada', featureKey: 'feature_bonus_most_conceded_team', pointsKey: 'points_bonus_most_conceded_team', defaultPts: 3 },
    ].filter(a => config[a.featureKey] === 'true')

    const bonusRange = [
      { key: 'bonus_red_cards_range', label: 'Tarjetas rojas en fase de grupos', featureKey: 'feature_bonus_red_cards_range' },
      { key: 'bonus_goals_range', label: 'Total de goles en fase de grupos', featureKey: 'feature_bonus_goals_range' },
      { key: 'bonus_penalties_range', label: 'Penales en fase de grupos', featureKey: 'feature_bonus_penalties_range' },
      { key: 'bonus_group_top_scorer', label: 'Goleador de fase de grupos', featureKey: 'feature_bonus_group_top_scorer' },
    ].filter(a => config[a.featureKey] === 'true')

    if (bonusTeam.length + bonusRange.length > 0) {
      const rows: unknown[][] = [
        ['PREGUNTAS BONUS'],
        ['clave', 'Pregunta', 'Tu respuesta', '', '', 'Opciones / Tipo'],
      ]
      for (const a of bonusTeam) {
        rows.push([a.key, a.label, '', '', '', `(equipo) — ${getConfigValue(config, a.pointsKey, a.defaultPts)} pts`])
      }
      for (const a of bonusRange) {
        const opts = getRangeOptions(config, a.key)
        const hint = opts.map(o => `${o.label} (${o.points}pts)`).join(' / ')
        rows.push([a.key, a.label, '', '', '', hint])
      }
      XLSX.utils.book_append_sheet(wb, makeSheet(rows), 'Bonus')
    }
  }

  // ── Custom questions sheet ────────────────────────────────────────────────────
  const enabledQuestions = questions.filter(q => q.enabled)
  if (config.feature_custom_questions === 'true' && enabledQuestions.length > 0) {
    const optsByQuestion = questionOptions.reduce<Record<string, PollaQuestionOption[]>>((acc, o) => {
      ;(acc[o.questionId] ??= []).push(o)
      return acc
    }, {})

    const rows: unknown[][] = [
      ['PREGUNTAS PERSONALIZADAS'],
      ['clave', 'Pregunta', 'Tu respuesta', '', '', 'Opciones / Tipo'],
    ]
    for (const q of enabledQuestions) {
      const opts = optsByQuestion[q.id] ?? []
      let hint: string
      if (q.type === 'range') {
        hint = opts.sort((a, b) => a.order - b.order).map(o => `${o.label} (${o.points}pts)`).join(' / ')
      } else if (q.type === 'team') {
        hint = `(equipo) — ${q.pointsValue ?? 5} pts`
      } else {
        hint = `(texto libre) — ${q.pointsValue ?? 5} pts`
      }
      rows.push([q.id, q.title, '', '', '', hint])
    }
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), 'Preguntas')
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}
