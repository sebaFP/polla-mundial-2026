export type Config = Record<string, string>
export type RangeOption = { label: string; points: number }

export const RANGE_OPTION_DEFAULTS: Record<string, RangeOption[]> = {
  options_bonus_red_cards_range: [
    { label: 'menos de 3', points: 10 },
    { label: 'Entre 3 y 6', points: 10 },
    { label: 'mas de 6', points: 10 },
  ],
  options_bonus_goals_range: [
    { label: 'menos de 140', points: 10 },
    { label: 'Entre 140 y 190', points: 10 },
    { label: 'mas de 190', points: 10 },
  ],
  options_bonus_penalties_range: [
    { label: 'menos de 15', points: 10 },
    { label: 'Entre 15 y 25', points: 10 },
    { label: 'mas de 25', points: 10 },
  ],
  options_bonus_group_top_scorer: [
    { label: 'Messi', points: 20 },
    { label: 'Mbappe', points: 20 },
    { label: 'C. Ronaldo', points: 20 },
  ],
}

export function getRangeOptions(config: Config, type: string): RangeOption[] {
  const key = `options_${type}`
  const stored = config[key]
  if (stored) {
    try { return JSON.parse(stored) as RangeOption[] } catch { /* */ }
  }
  return RANGE_OPTION_DEFAULTS[key] ?? []
}

export function getConfigValue(config: Config, key: string, fallback: number): number {
  return parseInt(config[key] ?? String(fallback))
}

export function calcMatchPoints(
  pred1: number, pred2: number,
  real1: number, real2: number,
  config: Config,
  penalties?: { home: number | null; away: number | null } | null
): number {
  // Coerce to numbers — DB drivers can return strings for integer columns
  const p1 = Number(pred1), p2 = Number(pred2)
  const r1 = Number(real1), r2 = Number(real2)
  if (p1 === r1 && p2 === r2)
    return getConfigValue(config, 'points_exact_score', 5)
  if ((p1 - p2) === (r1 - r2))
    return getConfigValue(config, 'points_goal_diff', 3)

  const tendencyPoints = getConfigValue(config, 'points_tendency', 2)
  if (Math.sign(p1 - p2) === Math.sign(r1 - r2))
    return tendencyPoints

  // Knockout draw decided by penalties: 'final_result' mode credits a
  // tendency hit to whoever picked the penalty-shootout winner, since the
  // exact/diff comparison above already used the regular-time draw score.
  if (
    r1 === r2 &&
    config.knockout_draw_scoring_mode === 'final_result' &&
    penalties?.home != null && penalties?.away != null
  ) {
    const penaltyWinnerSign = Math.sign(penalties.home - penalties.away)
    if (penaltyWinnerSign !== 0 && Math.sign(p1 - p2) === penaltyWinnerSign)
      return tendencyPoints
  }

  return 0
}

export function calcGroupPoints(
  predictedFirst: string, predictedSecond: string,
  actualFirst: string, actualSecond: string,
  config: Config,
  predictedThird?: string,
  actualThird?: string,
): { pointsFirst: number; pointsSecond: number; pointsThird: number } {
  return {
    pointsFirst: predictedFirst === actualFirst
      ? getConfigValue(config, 'points_group_winner', 6) : 0,
    pointsSecond: predictedSecond === actualSecond
      ? getConfigValue(config, 'points_group_runner_up', 4) : 0,
    pointsThird: (predictedThird && actualThird && predictedThird === actualThird)
      ? getConfigValue(config, 'points_group_third_place', 2) : 0,
  }
}

const RANGE_TYPES = ['bonus_red_cards_range', 'bonus_goals_range', 'bonus_penalties_range', 'bonus_group_top_scorer']

export function calcSpecialPoints(
  type: string,
  predicted: string,
  actual: string,
  config: Config
): number {
  if (predicted !== actual) return 0
  if (RANGE_TYPES.includes(type)) {
    const options = getRangeOptions(config, type)
    const matched = options.find(o => o.label === actual)
    if (matched) return matched.points
    return getConfigValue(config, `points_${type}`, 3)
  }
  switch (type) {
    case 'champion': return getConfigValue(config, 'points_champion', 20)
    case 'finalist': return getConfigValue(config, 'points_finalist', 10)
    case 'third': return getConfigValue(config, 'points_third_place', 8)
    case 'top_scorer': return getConfigValue(config, 'points_top_scorer', 15)
    case 'best_goalkeeper': return getConfigValue(config, 'points_best_goalkeeper', 15)
    case 'best_player': return getConfigValue(config, 'points_best_player', 15)
    case 'bonus_most_goals_team': return getConfigValue(config, 'points_bonus_most_goals_team', 5)
    case 'bonus_most_conceded_team': return getConfigValue(config, 'points_bonus_most_conceded_team', 3)
    default: return 0
  }
}

export const DEFAULT_CONFIG: Config = {
  points_exact_score: '5',
  points_goal_diff: '3',
  points_tendency: '2',
  points_group_winner: '6',
  points_group_runner_up: '4',
  points_group_third_place: '2',
  points_champion: '20',
  points_finalist: '10',
  points_third_place: '8',
  points_top_scorer: '15',
  feature_group_predictions: 'true',
  feature_special_predictions: 'true',
  feature_top_scorer: 'false',
  points_best_goalkeeper: '15',
  feature_best_goalkeeper: 'false',
  points_best_player: '15',
  feature_best_player: 'false',
  feature_bonus_predictions: 'false',
  feature_custom_questions: 'false',
  feature_bonus_most_goals_team: 'false',
  feature_bonus_most_conceded_team: 'false',
  feature_bonus_red_cards_range: 'false',
  feature_bonus_goals_range: 'false',
  feature_bonus_penalties_range: 'false',
  feature_bonus_group_top_scorer: 'false',
  points_bonus_most_goals_team: '5',
  points_bonus_most_conceded_team: '3',
  points_bonus_red_cards_range: '3',
  points_bonus_goals_range: '3',
  points_bonus_penalties_range: '3',
  points_bonus_group_top_scorer: '5',
  prediction_lock_minutes: '15',
  prediction_lock_mode: 'match',
  knockout_prediction_mode: 'api',
  knockout_draw_scoring_mode: 'regular_time',
  polla_open: 'true',
  rules_text: '',
  inscription_enabled: 'false',
  inscription_fee: '0',
  inscription_currency: 'CLP',
  inscription_requirements: '',
  prize_pool_enabled: 'false',
  prize_1_pct: '60',
  prize_2_pct: '30',
  prize_3_pct: '10',
  admin_fee_enabled: 'false',
  admin_fee_type: 'percentage',
  admin_fee_value: '0',
  polla_visibility: 'private',
}
