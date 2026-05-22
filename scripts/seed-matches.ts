/**
 * Seeds the matches table from openfootball/worldcup.json
 * Run once: pnpm tsx scripts/seed-matches.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { matches, tournamentConfig } from '../lib/db/schema'
import { DEFAULT_CONFIG } from '../lib/scoring'
import { eq } from 'drizzle-orm'

const WC_JSON_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

type RawMatch = {
  round: string
  date: string
  time: string
  team1: string
  team2: string
  group?: string
  ground?: string
  score?: { ft?: number[]; ht?: number[] }
}

type WCData = {
  name: string
  matches: RawMatch[]
}

function parseStage(round: string): string {
  const r = round.toLowerCase()
  if (r.includes('matchday') || r.includes('jornada') || r.includes('group')) return 'GROUP_STAGE'
  if (r.includes('round of 32') || r.includes('last 32') || r.includes('dieciseisavo') || r.includes('r32') || r.includes('round 1 ko')) return 'LAST_32'
  if (r.includes('round of 16') || r.includes('last 16') || r.includes('octavo') || r.includes('r16')) return 'LAST_16'
  if (r.includes('quarter') || r.includes('cuarto')) return 'QUARTER_FINALS'
  if (r.includes('semi') || r.includes('semi')) return 'SEMI_FINALS'
  if (r.includes('third') || r.includes('tercer') || r.includes('3rd') || r.includes('place')) return 'THIRD_PLACE'
  if (r.includes('final')) return 'FINAL'
  return 'GROUP_STAGE'
}

function parseMatchday(round: string): number | null {
  const m = round.match(/matchday\s*(\d+)/i)
  return m ? parseInt(m[1]) : null
}

function parseGroupName(match: RawMatch): string | null {
  if (match.group) return match.group
  const stage = parseStage(match.round)
  if (stage === 'GROUP_STAGE') {
    // Try to extract from round name
    const m = match.round.match(/group\s+([a-l])/i)
    if (m) return `Group ${m[1].toUpperCase()}`
  }
  return null
}

function parseDateTime(date: string, time: string, _tz: string): Date {
  // Parse "2026-06-11" + "13:00" → UTC
  // The times in worldcup.json are in local timezone, we'll use UTC approximation
  // For now, store as-is and let admin/API handle timezone
  try {
    // Extract UTC offset from time string like "13:00 UTC-6"
    const utcMatch = time.match(/UTC([+-]\d+)/)
    const timeOnly = time.replace(/\s*UTC[+-]\d+/, '').trim()
    const offsetHours = utcMatch ? parseInt(utcMatch[1]) : 0
    const dt = new Date(`${date}T${timeOnly}:00Z`)
    dt.setHours(dt.getHours() - offsetHours) // Convert to UTC
    return dt
  } catch {
    return new Date(`${date}T00:00:00Z`)
  }
}

async function main() {
  console.log('🌍 Fetching World Cup 2026 schedule...')

  const res = await fetch(WC_JSON_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)

  const data: WCData = await res.json()
  console.log(`📅 Found ${data.matches.length} matches`)

  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  let inserted = 0
  let skipped = 0

  for (let i = 0; i < data.matches.length; i++) {
    const m = data.matches[i]
    const stage = parseStage(m.round)
    const groupName = parseGroupName(m)
    const matchday = parseMatchday(m.round)
    const matchDatetime = parseDateTime(m.date, m.time ?? '00:00', '')

    // Lock time = match time - 15 minutes
    const lockTime = new Date(matchDatetime.getTime() - 15 * 60 * 1000)

    // Check if it's a group stage match (teams are resolved)
    const isGroupStage = stage === 'GROUP_STAGE'

    try {
      await db.insert(matches).values({
        externalId: `seed-${i + 1}`,
        stage,
        groupName,
        matchday,
        matchDatetime,
        team1: m.team1,
        team2: m.team2,
        team1Resolved: isGroupStage,
        team2Resolved: isGroupStage,
        venue: m.ground ?? null,
        status: 'SCHEDULED',
        lockTime,
      }).onConflictDoNothing()
      inserted++
    } catch (err) {
      console.error(`Skipping match ${i + 1}:`, err)
      skipped++
    }
  }

  console.log(`✅ Inserted ${inserted} matches, skipped ${skipped}`)

  // Seed default tournament config
  console.log('⚙️ Seeding tournament config...')
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await db.insert(tournamentConfig)
      .values({ key, value })
      .onConflictDoNothing()
  }

  // Seed generic reglamento (only if not already set)
  const REGLAMENTO = `# Reglamento Polla Mundial 2026

## Participación
- Cada participante recibe un código QR de acceso personal e intransferible.
- Solo se puede participar con el enlace o QR asignado por el organizador.
- La inscripción debe completarse antes del inicio del torneo.

## Pronósticos de Partidos
- Se puede pronosticar el marcador exacto de cada partido hasta 15 minutos antes del inicio.
- Una vez cerrado el plazo, no se aceptan cambios.
- Los pronósticos son individuales y confidenciales.

## Puntuación
- **Resultado exacto:** se aciertan ambos goles exactamente → 5 puntos
- **Diferencia de goles:** se acierta la diferencia (ej. ganar por 2) → 3 puntos
- **Tendencia:** se acierta quién gana, pierde o si empata → 2 puntos
- **Clasificados de grupo:** 1° lugar → 6 pts | 2° lugar → 4 pts
- **Predicciones especiales:** Campeón → 20 pts | Finalista → 10 pts | 3° lugar → 8 pts

## Pronósticos Especiales
- Antes del inicio del torneo se pueden ingresar predicciones especiales: campeón, finalista y tercer lugar.
- Estos pronósticos se cierran con el primer partido del torneo.

## Premios
- El pozo total se divide entre los mejores clasificados al finalizar el torneo.
- En caso de empate en puntos, se considera mayor cantidad de resultados exactos.
- Los premios se distribuyen al finalizar la Final (19 de julio de 2026).

## Fair Play
- Está prohibido compartir o transferir accesos.
- El organizador se reserva el derecho de descalificar participantes por conducta irregular.
- Las decisiones del organizador son inapelables.

---
*Reglamento sujeto a modificaciones. Última actualización: ${new Date().toLocaleDateString('es-CL')}*`

  await db.insert(tournamentConfig)
    .values({ key: 'rules_text', value: REGLAMENTO })
    .onConflictDoNothing()

  console.log('✅ Config seeded')

  await client.end()
  console.log('🎉 Done!')
}

main().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
