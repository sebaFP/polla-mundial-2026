// WC 2026 specific: parses the Copa-Mundial-FIFA-2026.xlsx template format
import * as XLSX from 'xlsx'
import { resolveTeamName } from './excel-team-mapping'

export type MatchPrediction = { matchNumber: number; team1: string; team2: string; score1: number; score2: number }
export type GroupPrediction = { group: string; firstPlace: string; secondPlace: string; thirdPlace?: string }
export type BonusPrediction = { type: string; value: string; isTeam: boolean }

export type ParsedExcel = {
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
  bonusPredictions: BonusPrediction[]
  unmatchedTeams: string[]
}

const GROUP_SHEETS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Bonus rows in "Preguntas Bonus" sheet (1-indexed row numbers)
const BONUS_ROW_MAP: Array<{ row: number; type: string; isTeam: boolean; options?: string[] }> = [
  { row: 2, type: 'bonus_most_goals_team', isTeam: true },
  { row: 3, type: 'bonus_most_conceded_team', isTeam: true },
  { row: 4, type: 'bonus_red_cards_range', isTeam: false, options: ['menos de 3', 'Entre 3 y 6', 'mas de 6'] },
  { row: 5, type: 'bonus_goals_range', isTeam: false, options: ['menos de 140', 'Entre 140 y 190', 'mas de 190'] },
  { row: 6, type: 'bonus_penalties_range', isTeam: false, options: ['menos de 15', 'Entre 15 y 25', 'mas de 25'] },
  { row: 7, type: 'bonus_group_top_scorer', isTeam: false, options: ['Messi', 'Mbappe', 'C. Ronaldo'] },
]

function normChoice(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()
}

function cellVal(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })
  return sheet[addr]?.v ?? null
}

export function parseExcelPredictions(buffer: ArrayBuffer): ParsedExcel {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  const matchPredictions: MatchPrediction[] = []
  const groupPredictions: GroupPrediction[] = []
  const bonusPredictions: BonusPrediction[] = []
  const unmatchedTeamsSet = new Set<string>()

  // Parse group sheets A–L
  for (const sheetName of GROUP_SHEETS) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    let firstPlace: string | undefined
    let secondPlace: string | undefined
    let thirdPlace: string | undefined

    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowNum = r + 1
      const col2 = cellVal(ws, rowNum, 2)  // match number
      const col6 = cellVal(ws, rowNum, 6)  // team1
      const col9 = cellVal(ws, rowNum, 9)  // score1
      const col11 = cellVal(ws, rowNum, 11) // score2
      const col14 = cellVal(ws, rowNum, 14) // team2
      const col16 = cellVal(ws, rowNum, 16) // "Primer lugar:" etc
      const col17 = cellVal(ws, rowNum, 17) // team name for standings

      // Match row detection: col B is integer, col F is team name string
      if (typeof col2 === 'number' && Number.isInteger(col2) && typeof col6 === 'string') {
        const score1 = typeof col9 === 'number' ? col9 : null
        const score2 = typeof col11 === 'number' ? col11 : null
        if (score1 !== null && score2 !== null) {
          const t1Spanish = col6.trim()
          const t2Spanish = typeof col14 === 'string' ? (col14 as string).trim() : ''
          const t1 = resolveTeamName(t1Spanish)
          const t2 = resolveTeamName(t2Spanish)
          if (!t1) unmatchedTeamsSet.add(t1Spanish)
          if (!t2) unmatchedTeamsSet.add(t2Spanish)
          if (t1 && t2) {
            matchPredictions.push({ matchNumber: col2, team1: t1, team2: t2, score1, score2 })
          }
        }
      }

      // Group standings rows
      if (col16 === 'Primer lugar:' && typeof col17 === 'string') {
        firstPlace = col17.trim()
      }
      if (col16 === 'Segundo lugar:' && typeof col17 === 'string') {
        secondPlace = col17.trim()
      }
      if (col16 === 'Tercer lugar:' && typeof col17 === 'string') {
        thirdPlace = col17.trim()
      }
    }

    if (firstPlace && secondPlace) {
      const resolvedFirst = resolveTeamName(firstPlace)
      const resolvedSecond = resolveTeamName(secondPlace)
      const resolvedThird = thirdPlace ? resolveTeamName(thirdPlace) : undefined

      if (!resolvedFirst) unmatchedTeamsSet.add(firstPlace)
      if (!resolvedSecond) unmatchedTeamsSet.add(secondPlace)
      if (thirdPlace && !resolvedThird) unmatchedTeamsSet.add(thirdPlace)

      if (resolvedFirst && resolvedSecond) {
        groupPredictions.push({
          group: `GROUP_${sheetName}`,
          firstPlace: resolvedFirst,
          secondPlace: resolvedSecond,
          thirdPlace: resolvedThird ?? undefined,
        })
      }
    }
  }

  // Parse "Dieciseisavos" (LAST_32) sheet for match predictions with scores
  const r32Sheet = wb.Sheets['Dieciseisavos']
  if (r32Sheet) {
    const range = XLSX.utils.decode_range(r32Sheet['!ref'] ?? 'A1')
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowNum = r + 1
      const col2 = cellVal(r32Sheet, rowNum, 2)
      const col6 = cellVal(r32Sheet, rowNum, 6)
      const col9 = cellVal(r32Sheet, rowNum, 9)
      const col11 = cellVal(r32Sheet, rowNum, 11)
      const col14r = cellVal(r32Sheet, rowNum, 14)
      if (typeof col2 === 'number' && Number.isInteger(col2) && typeof col6 === 'string') {
        const score1 = typeof col9 === 'number' ? col9 : null
        const score2 = typeof col11 === 'number' ? col11 : null
        if (score1 !== null && score2 !== null) {
          const t1Spanish = (col6 as string).trim()
          const t2Spanish = typeof col14r === 'string' ? (col14r as string).trim() : ''
          const t1 = resolveTeamName(t1Spanish)
          const t2 = resolveTeamName(t2Spanish)
          if (t1 && t2) {
            matchPredictions.push({ matchNumber: col2, team1: t1, team2: t2, score1, score2 })
          }
        }
      }
    }
  }

  // Parse "Preguntas Bonus" sheet
  const bonusSheet = wb.Sheets['Preguntas Bonus']
  if (bonusSheet) {
    for (const { row, type, isTeam, options } of BONUS_ROW_MAP) {
      const answer = cellVal(bonusSheet, row, 8) // col H
      if (typeof answer === 'string' && answer.trim()) {
        const value = answer.trim()
        let resolved = value
        if (isTeam) {
          const r = resolveTeamName(value)
          if (!r) {
            unmatchedTeamsSet.add(value)
          } else {
            resolved = r
          }
        } else if (options) {
          // Normalize to canonical option value (case-insensitive match)
          const canonical = options.find(o => normChoice(o) === normChoice(value))
          if (canonical) resolved = canonical
        }
        bonusPredictions.push({ type, value: resolved, isTeam })
      }
    }
  }

  return {
    matchPredictions,
    groupPredictions,
    bonusPredictions,
    unmatchedTeams: Array.from(unmatchedTeamsSet),
  }
}
