// Bulk import script: creates participants from /Planillas and imports their predictions
// Usage:
//   pnpm tsx scripts/bulk-import-planillas.ts           # create + import (skip existing)
//   pnpm tsx scripts/bulk-import-planillas.ts --force   # re-import for existing users, bypass lock checks
import 'dotenv/config'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, sql } from 'drizzle-orm'
import { parseExcelPredictions } from '../lib/excel-parser'
import {
  pollas, users, pollaMembers, invitations,
  predictions, groupPredictions, specialPredictions, matches,
} from '../lib/db/schema'

const conn = postgres(process.env.DATABASE_URL!)
const db = drizzle(conn)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PLANILLAS_DIR = join(process.cwd(), 'Planillas')
const POLLA_SLUG = 'polla-det'
const FORCE = process.argv.includes('--force')
const DEBUG = process.argv.includes('--debug')
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7) // --only="A. Bacigalupo"

type DbMatch = Awaited<ReturnType<typeof db.select<typeof matches['_']['columns']>>>
type AnyMatch = { id: number; team1: string; team2: string; lockTime: Date | null; status: string | null; stage: string; groupName: string | null; matchDatetime: Date }

function norm(name: string) {
  return name.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function avatarColor(idx: number) {
  const C = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#a855f7']
  return C[idx % C.length]
}

async function importPredictions(
  userId: string,
  pollaId: string,
  filePath: string,
  matchByTeams: Map<string, AnyMatch>,
  groupStageMatches: AnyMatch[],
) {
  const buffer = readFileSync(filePath).buffer as ArrayBuffer
  const parsed = parseExcelPredictions(buffer)

  // ── Match predictions ────────────────────────────────────────────────────
  const matchRows: { userId: string; pollaId: string; matchId: number; predictedScore1: number; predictedScore2: number }[] = []
  let skipped = 0

  for (const pred of parsed.matchPredictions) {
    const key = norm(pred.team1) + '|' + norm(pred.team2)
    const m = matchByTeams.get(key)
    if (!m) {
      skipped++
      if (DEBUG) console.log(`    SKIP partido: "${pred.team1}" vs "${pred.team2}" — no encontrado en DB (key: ${key})`)
      continue
    }
    if (!FORCE) {
      if (m.lockTime && new Date() >= m.lockTime) {
        skipped++
        if (DEBUG) console.log(`    SKIP partido: "${pred.team1}" vs "${pred.team2}" — bloqueado (lockTime: ${m.lockTime})`)
        continue
      }
      if (m.status !== 'SCHEDULED' && m.status !== 'TIMED') {
        skipped++
        if (DEBUG) console.log(`    SKIP partido: "${pred.team1}" vs "${pred.team2}" — status: ${m.status}`)
        continue
      }
    }
    const flip = norm(m.team1) !== norm(pred.team1)
    matchRows.push({ userId, pollaId, matchId: m.id, predictedScore1: flip ? pred.score2 : pred.score1, predictedScore2: flip ? pred.score1 : pred.score2 })
  }

  // ── Group predictions ────────────────────────────────────────────────────
  const groupRows: { userId: string; pollaId: string; groupName: string; firstPlace: string; secondPlace: string; thirdPlace: string | null }[] = []

  for (const pred of parsed.groupPredictions) {
    if (!FORCE) {
      const gms = groupStageMatches.filter(m => m.groupName === pred.group)
      if (gms.length > 0) {
        const first = gms.reduce((a, b) => a.matchDatetime < b.matchDatetime ? a : b)
        if (first.lockTime && new Date() >= new Date(first.lockTime)) {
          skipped++
          if (DEBUG) console.log(`    SKIP grupo ${pred.group} — bloqueado`)
          continue
        }
      }
    }
    if (DEBUG) console.log(`    grupo ${pred.group}: 1°${pred.firstPlace} 2°${pred.secondPlace}${pred.thirdPlace ? ` 3°${pred.thirdPlace}` : ''}`)
    groupRows.push({ userId, pollaId, groupName: pred.group, firstPlace: pred.firstPlace, secondPlace: pred.secondPlace, thirdPlace: pred.thirdPlace ?? null })
  }

  // ── Bonus/special predictions ────────────────────────────────────────────
  const specialRows: { userId: string; pollaId: string; type: string; teamName: string | null; playerName: string | null }[] = []

  const earliestGroup = groupStageMatches.length > 0
    ? groupStageMatches.reduce((a, b) => a.matchDatetime < b.matchDatetime ? a : b)
    : null
  const bonusLocked = !FORCE && !!(earliestGroup?.lockTime && new Date() >= new Date(earliestGroup.lockTime))

  if (!bonusLocked) {
    for (const pred of parsed.bonusPredictions) {
      specialRows.push({ userId, pollaId, type: pred.type, teamName: pred.isTeam ? pred.value : null, playerName: pred.isTeam ? null : pred.value })
    }
  } else {
    skipped += parsed.bonusPredictions.length
  }

  // ── Batch inserts (one query per table) ──────────────────────────────────
  let imported = 0

  if (matchRows.length > 0) {
    await db.insert(predictions).values(matchRows).onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId, predictions.pollaId],
      set: { predictedScore1: sql`excluded.predicted_score1`, predictedScore2: sql`excluded.predicted_score2`, updatedAt: new Date() },
    })
    imported += matchRows.length
  }

  if (groupRows.length > 0) {
    await db.insert(groupPredictions).values(groupRows).onConflictDoUpdate({
      target: [groupPredictions.userId, groupPredictions.groupName, groupPredictions.pollaId],
      set: { firstPlace: sql`excluded.first_place`, secondPlace: sql`excluded.second_place`, thirdPlace: sql`excluded.third_place` },
    })
    imported += groupRows.length
  }

  if (specialRows.length > 0) {
    await db.insert(specialPredictions).values(specialRows).onConflictDoUpdate({
      target: [specialPredictions.userId, specialPredictions.type, specialPredictions.pollaId],
      set: { teamName: sql`excluded.team_name`, playerName: sql`excluded.player_name` },
    })
    imported += specialRows.length
  }

  return { imported, skipped }
}

async function main() {
  const [polla] = await db.select({ id: pollas.id, name: pollas.name })
    .from(pollas).where(eq(pollas.slug, POLLA_SLUG)).limit(1)
  if (!polla) { console.error(`Polla "${POLLA_SLUG}" no encontrada`); process.exit(1) }
  console.log(`✓ Polla: ${polla.name} (${polla.id})\n`)

  const allMatches = await db.select().from(matches)
  const matchByTeams = new Map<string, AnyMatch>()
  for (const m of allMatches) {
    matchByTeams.set(norm(m.team1) + '|' + norm(m.team2), m as AnyMatch)
    matchByTeams.set(norm(m.team2) + '|' + norm(m.team1), m as AnyMatch)
  }
  const groupStageMatches = allMatches.filter(m => m.stage === 'GROUP_STAGE') as AnyMatch[]

  const existing = await db.select({ userId: pollaMembers.userId, name: users.name })
    .from(pollaMembers).innerJoin(users, eq(pollaMembers.userId, users.id))
    .where(eq(pollaMembers.pollaId, polla.id))
  const existingMap = new Map(existing.map(e => [e.name.toLowerCase().trim(), e.userId]))
  console.log(`Existing members: ${existing.length}${FORCE ? ' (--force)' : ''}\n`)

  let files = readdirSync(PLANILLAS_DIR)
    .filter(f => f.endsWith('.xlsx') && f.startsWith('Copa-Mundial-FIFA-2026 '))
  if (ONLY) files = files.filter(f => f.toLowerCase().includes(ONLY.toLowerCase()))
  console.log(`Found ${files.length} planillas\n`)

  const [{ count: userCount }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users)
  let userIdx = Number(userCount)
  let created = 0, updated = 0, skipped = 0, errors = 0

  for (const file of files) {
    const name = file.replace(/^Copa-Mundial-FIFA-2026 /, '').replace(/\.xlsx$/, '')
    const filePath = join(PLANILLAS_DIR, file)
    process.stdout.write(`[${name}] `)

    const existingUserId = existingMap.get(name.toLowerCase().trim())

    if (existingUserId) {
      if (!FORCE) {
        console.log('SKIP (usa --force para re-importar)')
        skipped++; continue
      }
      try {
        const { imported, skipped: s } = await importPredictions(existingUserId, polla.id, filePath, matchByTeams, groupStageMatches)
        console.log(`actualizado — ${imported} pronósticos${s > 0 ? `, ${s} omitidos` : ''}`)
        updated++
      } catch (err) {
        console.log(`ERROR: ${err}`)
        errors++
      }
      continue
    }

    // New user
    const qrToken = randomUUID()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `p-${qrToken}@polla.internal`,
      password: qrToken,
      email_confirm: true,
      user_metadata: { name },
    })
    if (authError || !authData.user) {
      console.log(`ERROR auth: ${authError?.message}`)
      errors++; continue
    }

    let userId: string
    try {
      const [u] = await db.insert(users).values({ id: authData.user.id, name, avatarColor: avatarColor(userIdx++), isSuperAdmin: false }).returning({ id: users.id })
      userId = u.id
      await db.insert(invitations).values({ userId, pollaId: polla.id, token: qrToken })
      await db.insert(pollaMembers).values({ pollaId: polla.id, userId, role: 'participant', inscriptionStatus: 'pending' })
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.log(`ERROR db: ${err}`)
      errors++; continue
    }

    try {
      const { imported, skipped: s } = await importPredictions(userId, polla.id, filePath, matchByTeams, groupStageMatches)
      console.log(`OK — ${imported} pronósticos${s > 0 ? `, ${s} omitidos` : ''}`)
      created++
    } catch (err) {
      console.log(`ERROR import: ${err}`)
      errors++
    }
  }

  console.log(`\n──────────────────────────────`)
  console.log(`Creados: ${created} | Actualizados: ${updated} | Skipped: ${skipped} | Errores: ${errors}`)
  await conn.end()
}

main().catch(e => { console.error(e); process.exit(1) })
