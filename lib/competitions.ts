export type Competition = {
  id: number
  code: string
  name: string
  area: string
  type: 'LEAGUE' | 'CUP' | 'PLAYOFFS' | 'SUPER_CUP'
  emblem: string | null
  plan: 'TIER_ONE' | 'TIER_TWO' | 'TIER_THREE' | 'TIER_FOUR'
}

export const COMPETITIONS: Competition[] = [
  // ── International ──────────────────────────────────────────────────────────
  { id: 2000, code: 'WC',   name: 'FIFA World Cup',          area: 'World',   type: 'CUP',    emblem: 'https://crests.football-data.org/wm26.png',   plan: 'TIER_ONE' },
  { id: 2001, code: 'CL',   name: 'UEFA Champions League',   area: 'Europe',  type: 'CUP',    emblem: 'https://crests.football-data.org/CL.png',     plan: 'TIER_TWO' },
  { id: 2146, code: 'EL',   name: 'UEFA Europa League',      area: 'Europe',  type: 'CUP',    emblem: 'https://crests.football-data.org/EL.png',     plan: 'TIER_TWO' },
  { id: 2154, code: 'UCL',  name: 'UEFA Conference League',  area: 'Europe',  type: 'CUP',    emblem: 'https://crests.football-data.org/UCL.png',    plan: 'TIER_FOUR' },
  { id: 2018, code: 'EC',   name: 'European Championship',   area: 'Europe',  type: 'CUP',    emblem: 'https://crests.football-data.org/ec.png',     plan: 'TIER_ONE' },
  { id: 2080, code: 'CA',   name: 'Copa América',            area: 'S. America', type: 'CUP', emblem: null,                                          plan: 'TIER_FOUR' },
  { id: 2178, code: 'FCWC', name: 'FIFA Club World Cup',     area: 'World',   type: 'CUP',    emblem: null,                                          plan: 'TIER_TWO' },
  { id: 2176, code: 'AC',   name: 'Africa Cup of Nations',   area: 'Africa',  type: 'CUP',    emblem: 'https://crests.football-data.org/ac.png',     plan: 'TIER_FOUR' },
  { id: 2167, code: 'WCF',  name: "FIFA Women's World Cup",  area: 'World',   type: 'CUP',    emblem: 'https://crests.football-data.org/fwwc.svg',   plan: 'TIER_TWO' },

  // ── Top European Leagues ───────────────────────────────────────────────────
  { id: 2021, code: 'PL',   name: 'Premier League',          area: 'England',     type: 'LEAGUE', emblem: 'https://crests.football-data.org/PL.png',      plan: 'TIER_ONE' },
  { id: 2014, code: 'PD',   name: 'La Liga',                 area: 'Spain',       type: 'LEAGUE', emblem: 'https://crests.football-data.org/laliga.png',  plan: 'TIER_ONE' },
  { id: 2002, code: 'BL1',  name: 'Bundesliga',              area: 'Germany',     type: 'LEAGUE', emblem: 'https://crests.football-data.org/BL1.png',     plan: 'TIER_ONE' },
  { id: 2019, code: 'SA',   name: 'Serie A',                 area: 'Italy',       type: 'LEAGUE', emblem: 'https://crests.football-data.org/c111.png',    plan: 'TIER_ONE' },
  { id: 2015, code: 'FL1',  name: 'Ligue 1',                 area: 'France',      type: 'LEAGUE', emblem: 'https://crests.football-data.org/FL1.png',     plan: 'TIER_ONE' },
  { id: 2003, code: 'DED',  name: 'Eredivisie',              area: 'Netherlands', type: 'LEAGUE', emblem: 'https://crests.football-data.org/ED.png',      plan: 'TIER_ONE' },
  { id: 2017, code: 'PPL',  name: 'Primeira Liga',           area: 'Portugal',    type: 'LEAGUE', emblem: 'https://crests.football-data.org/PPL.png',     plan: 'TIER_ONE' },
  { id: 2016, code: 'ELC',  name: 'Championship',            area: 'England',     type: 'LEAGUE', emblem: 'https://crests.football-data.org/ELC.png',     plan: 'TIER_ONE' },
  { id: 2004, code: 'BL2',  name: '2. Bundesliga',           area: 'Germany',     type: 'LEAGUE', emblem: 'https://crests.football-data.org/BL2.png',     plan: 'TIER_TWO' },
  { id: 2084, code: 'SPL',  name: 'Scottish Premiership',    area: 'Scotland',    type: 'LEAGUE', emblem: 'https://crests.football-data.org/SPL.png',     plan: 'TIER_TWO' },
  { id: 2009, code: 'BJL',  name: 'Jupiler Pro League',      area: 'Belgium',     type: 'LEAGUE', emblem: 'https://crests.football-data.org/bjl.png',     plan: 'TIER_TWO' },

  // ── Americas & Rest ────────────────────────────────────────────────────────
  { id: 2013, code: 'BSA',  name: 'Brasileirão Série A',     area: 'Brazil',   type: 'LEAGUE', emblem: 'https://crests.football-data.org/bsa.png',    plan: 'TIER_ONE' },
  { id: 2024, code: 'ASL',  name: 'Liga Profesional',        area: 'Argentina', type: 'LEAGUE', emblem: 'https://crests.football-data.org/LPDF.svg',  plan: 'TIER_TWO' },
  { id: 2145, code: 'MLS',  name: 'MLS',                     area: 'USA',      type: 'LEAGUE', emblem: 'https://crests.football-data.org/MLS.png',    plan: 'TIER_TWO' },
  { id: 2152, code: 'CLI',  name: 'Copa Libertadores',       area: 'S. America', type: 'CUP', emblem: 'https://crests.football-data.org/CLI.svg',    plan: 'TIER_FOUR' },
  { id: 2048, code: 'CPD',  name: 'Primera División',        area: 'Chile',    type: 'LEAGUE', emblem: 'https://crests.football-data.org/cpd.png',    plan: 'TIER_THREE' },
  { id: 2119, code: 'JJL',  name: 'J. League',               area: 'Japan',    type: 'LEAGUE', emblem: 'https://crests.football-data.org/jjl.png',    plan: 'TIER_TWO' },
  { id: 2008, code: 'AAL',  name: 'A-League',                area: 'Australia', type: 'LEAGUE', emblem: 'https://crests.football-data.org/a-league.png', plan: 'TIER_TWO' },

  // ── Cups ───────────────────────────────────────────────────────────────────
  { id: 2055, code: 'FAC',  name: 'FA Cup',                  area: 'England',  type: 'CUP',    emblem: 'https://crests.football-data.org/fa_cup.png', plan: 'TIER_TWO' },
  { id: 2011, code: 'DFB',  name: 'DFB-Pokal',               area: 'Germany',  type: 'CUP',    emblem: 'https://crests.football-data.org/DFB_CUP.png', plan: 'TIER_TWO' },
  { id: 2079, code: 'CDR',  name: 'Copa del Rey',            area: 'Spain',    type: 'CUP',    emblem: null,                                          plan: 'TIER_THREE' },
]

export function getCompetitionById(id: number): Competition | undefined {
  return COMPETITIONS.find(c => c.id === id)
}

export function getCompetitionByCode(code: string): Competition | undefined {
  return COMPETITIONS.find(c => c.code === code)
}
