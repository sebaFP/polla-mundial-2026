import * as XLSX from 'xlsx'

export type ParsedTemplate = {
  matchPredictions: { matchId: number; score1: number; score2: number }[]
  groupPredictions: { key: string; team: string }[]
  specialPredictions: { type: string; value: string }[]
  bonusPredictions: { type: string; value: string }[]
  questionAnswers: { questionId: string; answer: string }[]
  errors: string[]
}

const SPECIAL_TYPES = new Set(['champion', 'finalist', 'third'])
const PLAYER_AWARD_TYPES = new Set(['top_scorer', 'best_goalkeeper', 'best_player'])
const GROUP_KEY_RE = /^GROUP_[A-L]_(FIRST|SECOND|THIRD)$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  if (!cell || cell.v == null) return null
  const s = String(cell.v).trim()
  return s || null
}

function cellNum(ws: XLSX.WorkSheet, r: number, c: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  if (!cell || cell.v == null) return null
  const n = Number(cell.v)
  return isNaN(n) ? null : n
}

export function parsePredictionTemplate(buffer: ArrayBuffer): ParsedTemplate {
  const result: ParsedTemplate = {
    matchPredictions: [],
    groupPredictions: [],
    specialPredictions: [],
    bonusPredictions: [],
    questionAnswers: [],
    errors: [],
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  } catch {
    result.errors.push('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.')
    return result
  }

  // Validate version on Info sheet
  const infoSheet = wb.Sheets['Info']
  if (!infoSheet) {
    result.errors.push('Planilla no compatible. Descarga la nueva planilla oficial desde el botón "Descargar Planilla".')
    return result
  }

  const infoRange = XLSX.utils.decode_range(infoSheet['!ref'] ?? 'A1')
  let versionOk = false
  for (let r = infoRange.s.r; r <= infoRange.e.r; r++) {
    if (cellStr(infoSheet, r, 0) === 'VERSION' && cellStr(infoSheet, r, 1) === 'POLLA_TEMPLATE_V2') {
      versionOk = true
      break
    }
  }

  if (!versionOk) {
    result.errors.push('Planilla no compatible. Descarga la nueva planilla oficial desde el botón "Descargar Planilla".')
    return result
  }

  // Parse all sheets except Info
  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Info') continue
    const ws = wb.Sheets[sheetName]
    if (!ws || !ws['!ref']) continue

    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let r = range.s.r; r <= range.e.r; r++) {
      const keyRaw = cellStr(ws, r, 0) // col A = key
      if (!keyRaw) continue

      // Integer → match prediction (matchId in col A, score1 in col C, score2 in col E)
      const numKey = Number(keyRaw)
      if (Number.isInteger(numKey) && numKey > 0 && String(numKey) === keyRaw) {
        const s1 = cellNum(ws, r, 2)
        const s2 = cellNum(ws, r, 4)
        if (s1 !== null && s2 !== null && Number.isInteger(s1) && Number.isInteger(s2) && s1 >= 0 && s2 >= 0) {
          result.matchPredictions.push({ matchId: numKey, score1: s1, score2: s2 })
        }
        continue
      }

      // GROUP_X_RANK → group prediction (team name in col C)
      if (GROUP_KEY_RE.test(keyRaw)) {
        const team = cellStr(ws, r, 2)
        if (team) result.groupPredictions.push({ key: keyRaw, team })
        continue
      }

      // champion / finalist / third → special prediction (value in col C)
      if (SPECIAL_TYPES.has(keyRaw)) {
        const value = cellStr(ws, r, 2)
        if (value) result.specialPredictions.push({ type: keyRaw, value })
        continue
      }

      // top_scorer / best_goalkeeper / best_player → bonus (player name in col C)
      if (PLAYER_AWARD_TYPES.has(keyRaw)) {
        const value = cellStr(ws, r, 2)
        if (value) result.bonusPredictions.push({ type: keyRaw, value })
        continue
      }

      // bonus_* → bonus prediction (value in col C)
      if (keyRaw.startsWith('bonus_')) {
        const value = cellStr(ws, r, 2)
        if (value) result.bonusPredictions.push({ type: keyRaw, value })
        continue
      }

      // UUID → custom question answer (answer in col C)
      if (UUID_RE.test(keyRaw)) {
        const answer = cellStr(ws, r, 2)
        if (answer) result.questionAnswers.push({ questionId: keyRaw, answer })
        continue
      }
    }
  }

  return result
}
