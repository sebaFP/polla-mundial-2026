// Bulk import script: creates participants from /Planillas and imports their predictions
// Usage: pnpm tsx scripts/bulk-import-planillas.ts
import 'dotenv/config'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and } from 'drizzle-orm'
import { parseExcelPredictions } from '../lib/excel-parser'

// ── DB setup ─────────────────────────────────────────────────────────────────
const conn = postgres(process.env.DATABASE_URL!)
const db = drizzle(conn)

// ── Supabase admin ────────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Schema (inline to avoid module resolution issues in script) ───────────────
import {
  pollas, users, pollaMembers, invitations,
  predictions, groupPredictions, specialPredictions, matches,
} from '../lib/db/schema'
import { sql } from 'drizzle-orm'

const PLANILLAS_DIR = join(process.cwd(), 'Planillas')
const POLLA_SLUG = 'polla-det'

function normalizeTeam(name: string): string {
  return name.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function getAvatarColor(idx: number): string {
  const COLORS = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#a855f7']
  return COLORS[idx % COLORS.length]
}

async function main() {
  // Get polla
  const [polla] = await db.select({ id: pollas.id, name: pollas.name })
    .from(pollas).where(eq(pollas.slug, POLLA_SLUG)).limit(1)
  if (!polla) { console.error(`Polla "${POLLA_SLUG}" no encontrada`); process.exit(1) }
  console.log(`✓ Polla: ${polla.name} (${polla.id})\n`)

  // Get all matches once
  const allMatches = await db.select().from(matches)
  const matchByTeams = new Map<string, typeof allMatches[0]>()
  for (const m of allMatches) {
    matchByTeams.set(normalizeTeam(m.team1) + '|' + normalizeTeam(m.team2), m)
    matchByTeams.set(normalizeTeam(m.team2) + '|' + normalizeTeam(m.team1), m)
  }
  const groupStageMatches = allMatches.filter(m => m.stage === 'GROUP_STAGE')

  // Get existing members to skip duplicates
  const existing = await db.select({ userId: pollaMembers.userId, name: users.name })
    .from(pollaMembers)
    .innerJoin(users, eq(pollaMembers.userId, users.id))
    .where(eq(pollaMembers.pollaId, polla.id))
  const existingNames = new Set(existing.map(e => e.name.toLowerCase().trim()))
  console.log(`Existing members: ${existing.length}\n`)

  // List files
  const files = readdirSync(PLANILLAS_DIR)
    .filter(f => f.endsWith('.xlsx') && f.startsWith('Copa-Mundial-FIFA-2026 '))

  console.log(`Found ${files.length} planillas\n`)

  const [{ count: userCount }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users)
  let userIdx = Number(userCount)

  let created = 0, skipped = 0, errors = 0

  for (const file of files) {
    const name = file.replace(/^Copa-Mundial-FIFA-2026 /, '').replace(/\.xlsx$/, '')
    const filePath = join(PLANILLAS_DIR, file)

    process.stdout.write(`[${name}] `)

    // Skip if already exists
    if (existingNames.has(name.toLowerCase().trim())) {
      console.log('SKIP (ya existe)')
      skipped++
      continue
    }

    // Create auth user
    const qrToken = randomUUID()
    const internalEmail = `p-${qrToken}@polla.internal`

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: qrToken,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError || !authData.user) {
      console.log(`ERROR auth: ${authError?.message}`)
      errors++
      continue
    }

    let userId: string
    try {
      const [created_user] = await db.insert(users).values({
        id: authData.user.id,
        name,
        avatarColor: getAvatarColor(userIdx++),
        isSuperAdmin: false,
      }).returning({ id: users.id })

      userId = created_user.id

      await db.insert(invitations).values({ userId, pollaId: polla.id, token: qrToken })
      await db.insert(pollaMembers).values({ pollaId: polla.id, userId, role: 'participant', inscriptionStatus: 'pending' })
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.log(`ERROR db: ${err}`)
      errors++
      continue
    }

    // Parse xlsx
    let parsed
    try {
      const buffer = readFileSync(filePath).buffer
      parsed = parseExcelPredictions(buffer)
    } catch (err) {
      console.log(`ERROR parse: ${err}`)
      errors++
      continue
    }

    let imported = 0, imp_skipped = 0

    // Import match predictions
    for (const pred of parsed.matchPredictions) {
      const match = matchByTeams.get(normalizeTeam(pred.team1) + '|' + normalizeTeam(pred.team2))
      if (!match) { imp_skipped++; continue }
      if (match.lockTime && new Date() >= match.lockTime) { imp_skipped++; continue }
      if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') { imp_skipped++; continue }
      const dbT1 = normalizeTeam(match.team1)
      const exT1 = normalizeTeam(pred.team1)
      const s1 = dbT1 === exT1 ? pred.score1 : pred.score2
      const s2 = dbT1 === exT1 ? pred.score2 : pred.score1
      try {
        await db.insert(predictions).values({ userId, pollaId: polla.id, matchId: match.id, predictedScore1: s1, predictedScore2: s2 })
          .onConflictDoUpdate({
            target: [predictions.userId, predictions.matchId, predictions.pollaId],
            set: { predictedScore1: s1, predictedScore2: s2, updatedAt: new Date() },
          })
        imported++
      } catch { imp_skipped++ }
    }

    // Import group predictions
    for (const pred of parsed.groupPredictions) {
      const gms = groupStageMatches.filter(m => m.groupName === pred.group)
      if (gms.length > 0) {
        const first = gms.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
        if (first.lockTime && new Date() >= new Date(first.lockTime)) { imp_skipped++; continue }
      }
      try {
        await db.insert(groupPredictions).values({
          userId, pollaId: polla.id, groupName: pred.group,
          firstPlace: pred.firstPlace, secondPlace: pred.secondPlace, thirdPlace: pred.thirdPlace ?? null,
        }).onConflictDoUpdate({
          target: [groupPredictions.userId, groupPredictions.groupName, groupPredictions.pollaId],
          set: { firstPlace: pred.firstPlace, secondPlace: pred.secondPlace, thirdPlace: pred.thirdPlace ?? null },
        })
        imported++
      } catch { imp_skipped++ }
    }

    // Import bonus/special predictions
    const earliestGroup = groupStageMatches.length > 0
      ? groupStageMatches.reduce((e, m) => m.matchDatetime < e.matchDatetime ? m : e)
      : null
    const bonusLocked = !!(earliestGroup?.lockTime && new Date() >= new Date(earliestGroup.lockTime))

    if (!bonusLocked) {
      for (const pred of parsed.bonusPredictions) {
        try {
          await db.insert(specialPredictions).values({
            userId, pollaId: polla.id, type: pred.type,
            teamName: pred.isTeam ? pred.value : null,
            playerName: pred.isTeam ? null : pred.value,
          }).onConflictDoUpdate({
            target: [specialPredictions.userId, specialPredictions.type, specialPredictions.pollaId],
            set: { teamName: pred.isTeam ? pred.value : null, playerName: pred.isTeam ? null : pred.value },
          })
          imported++
        } catch { imp_skipped++ }
      }
    } else {
      imp_skipped += parsed.bonusPredictions.length
    }

    console.log(`OK — ${imported} pronósticos${imp_skipped > 0 ? `, ${imp_skipped} omitidos` : ''}`)
    created++
  }

  console.log(`\n──────────────────────────────`)
  console.log(`Creados: ${created} | Skipped: ${skipped} | Errores: ${errors}`)
  await conn.end()
}

main().catch(e => { console.error(e); process.exit(1) })
