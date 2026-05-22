const BASE_URL = 'https://api.football-data.org/v4'

export type FDMatch = {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string | null
  matchday: number | null
  homeTeam: { name: string; shortName: string }
  awayTeam: { name: string; shortName: string }
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  venue: string | null
}

export type FDResponse = {
  matches: FDMatch[]
  resultSet?: {
    count: number
    competitions: string
    first: string
    last: string
    played: number
  }
}

async function fdFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    headers: {
      'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export async function getWCMatches(status?: string): Promise<FDMatch[]> {
  const params: Record<string, string> = {}
  if (status) params.status = status
  const data = await fdFetch<FDResponse>('/competitions/WC/matches', params)
  return data.matches ?? []
}

export async function getWCMatchesOnDate(date: string): Promise<FDMatch[]> {
  const data = await fdFetch<FDResponse>('/competitions/WC/matches', {
    dateFrom: date,
    dateTo: date,
  })
  return data.matches ?? []
}

export async function getActiveWCMatches(): Promise<FDMatch[]> {
  return getWCMatches('IN_PLAY,PAUSED,FINISHED')
}
