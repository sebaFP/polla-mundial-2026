export type Config = Record<string, string>

export function getConfigValue(config: Config, key: string, fallback: number): number {
  return parseInt(config[key] ?? String(fallback))
}

export function calcMatchPoints(
  pred1: number, pred2: number,
  real1: number, real2: number,
  config: Config
): number {
  if (pred1 === real1 && pred2 === real2)
    return getConfigValue(config, 'points_exact_score', 5)
  if ((pred1 - pred2) === (real1 - real2))
    return getConfigValue(config, 'points_goal_diff', 3)
  if (Math.sign(pred1 - pred2) === Math.sign(real1 - real2))
    return getConfigValue(config, 'points_tendency', 2)
  return 0
}

export function calcGroupPoints(
  predictedFirst: string, predictedSecond: string,
  actualFirst: string, actualSecond: string,
  config: Config
): { pointsFirst: number; pointsSecond: number } {
  return {
    pointsFirst: predictedFirst === actualFirst
      ? getConfigValue(config, 'points_group_winner', 6) : 0,
    pointsSecond: predictedSecond === actualSecond
      ? getConfigValue(config, 'points_group_runner_up', 4) : 0,
  }
}

export function calcSpecialPoints(
  type: string,
  predicted: string,
  actual: string,
  config: Config
): number {
  if (predicted !== actual) return 0
  switch (type) {
    case 'champion': return getConfigValue(config, 'points_champion', 20)
    case 'finalist': return getConfigValue(config, 'points_finalist', 10)
    case 'third': return getConfigValue(config, 'points_third_place', 8)
    case 'top_scorer': return getConfigValue(config, 'points_top_scorer', 15)
    default: return 0
  }
}

export const DEFAULT_CONFIG: Config = {
  points_exact_score: '5',
  points_goal_diff: '3',
  points_tendency: '2',
  points_group_winner: '6',
  points_group_runner_up: '4',
  points_champion: '20',
  points_finalist: '10',
  points_third_place: '8',
  points_top_scorer: '15',
  feature_group_predictions: 'true',
  feature_special_predictions: 'true',
  feature_top_scorer: 'false',
  prediction_lock_minutes: '15',
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
}
