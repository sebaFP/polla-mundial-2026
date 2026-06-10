// WC 2026 specific: Spanish names from the Copa-Mundial-FIFA-2026.xlsx template → English API names
const SPANISH_TO_ENGLISH: Record<string, string> = {
  'ALEMANIA': 'Germany',
  'ARABIA SAUDITA': 'Saudi Arabia',
  'ARGELIA': 'Algeria',
  'ARGENTINA': 'Argentina',
  'AUSTRALIA': 'Australia',
  'AUSTRIA': 'Austria',
  'BOSNIA y HERZEG.': 'Bosnia-Herzegovina',
  'BRASIL': 'Brazil',
  'BÉLGICA': 'Belgium',
  'CABO VERDE': 'Cape Verde Islands',
  'CANADÁ': 'Canada',
  'CATAR': 'Qatar',
  'COLOMBIA': 'Colombia',
  'COREA del SUR': 'South Korea',
  'COSTA de MARFIL': 'Ivory Coast',
  'CROACIA': 'Croatia',
  'CURAZAO': 'Curaçao',
  'ECUADOR': 'Ecuador',
  'EGIPTO': 'Egypt',
  'ESCOCIA': 'Scotland',
  'ESPAÑA': 'Spain',
  'ESTADOS UNIDOS': 'United States',
  'FRANCIA': 'France',
  'GHANA': 'Ghana',
  'HAITÍ': 'Haiti',
  'INGLATERRA': 'England',
  'IRAK': 'Iraq',
  'IRÁN': 'Iran',
  'JAPÓN': 'Japan',
  'JORDANIA': 'Jordan',
  'MARRUECOS': 'Morocco',
  'MÉXICO': 'Mexico',
  'NORUEGA': 'Norway',
  'NUEVA ZELANDA': 'New Zealand',
  'PANAMÁ': 'Panama',
  'PARAGUAY': 'Paraguay',
  'PAÍSES BAJOS': 'Netherlands',
  'PORTUGAL': 'Portugal',
  'REP. CHECA': 'Czechia',
  'REP. del CONGO': 'Congo DR',
  'SENEGAL': 'Senegal',
  'SUDÁFRICA': 'South Africa',
  'SUECIA': 'Sweden',
  'SUIZA': 'Switzerland',
  'TURQUÍA': 'Turkey',
  'TÚNEZ': 'Tunisia',
  'URUGUAY': 'Uruguay',
  'UZBEKISTÁN': 'Uzbekistan',
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[.\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Build normalized lookup once
const normalizedMap = new Map<string, string>()
for (const [spanish, english] of Object.entries(SPANISH_TO_ENGLISH)) {
  normalizedMap.set(normalize(spanish), english)
}

export function resolveTeamName(input: string): string | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // 1. Direct lookup (case-insensitive, normalized)
  const norm = normalize(trimmed)
  const direct = normalizedMap.get(norm)
  if (direct) return direct

  // 2. Also try direct English name passthrough (in case user typed English)
  const englishValues = Object.values(SPANISH_TO_ENGLISH)
  const englishMatch = englishValues.find(e => normalize(e) === norm)
  if (englishMatch) return englishMatch

  // 3. Levenshtein ≤ 2 against all normalized Spanish keys
  let bestDist = Infinity
  let bestEnglish: string | null = null
  for (const [normKey, english] of normalizedMap.entries()) {
    const dist = levenshtein(norm, normKey)
    if (dist < bestDist) {
      bestDist = dist
      bestEnglish = english
    }
  }
  if (bestDist <= 2) return bestEnglish

  return null
}
