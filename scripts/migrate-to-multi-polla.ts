/**
 * Migration script: single-polla → multi-polla
 * Creates a default polla from existing data and migrates all records.
 *
 * Run AFTER pnpm db:push (new schema applied).
 * Run: npx tsx scripts/migrate-to-multi-polla.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../lib/db/schema'
import { eq, isNull } from 'drizzle-orm'
import { DEFAULT_CONFIG } from '../lib/scoring'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client, { schema })

  console.log('🔍 Checking existing data...')

  // Check if migration already ran
  const existingPollas = await db.select().from(schema.pollas)
  if (existingPollas.length > 0) {
    console.log(`✅ Already migrated (${existingPollas.length} polla(s) exist). Skipping.`)
    await client.end()
    return
  }

  // Find the first admin user (superadmin)
  const adminUsers = await db.select().from(schema.users).where(eq(schema.users.isSuperAdmin, true))
  if (adminUsers.length === 0) {
    console.error('❌ No superadmin user found. Run pnpm seed:admin first.')
    await client.end()
    process.exit(1)
  }
  const adminUser = adminUsers[0]

  console.log(`👤 Admin: ${adminUser.name} <${adminUser.email}>`)
  console.log('📦 Creating default polla "Polla Mundial 2026"...')

  // Create default polla
  const [polla] = await db.insert(schema.pollas).values({
    name: 'Polla Mundial 2026',
    slug: 'mundial-2026',
    description: 'La polla original del Mundial 2026',
    createdBy: adminUser.id,
  }).returning()

  console.log(`✅ Polla created: ${polla.slug} (${polla.id})`)

  // Add admin as polla admin
  await db.insert(schema.pollaMembers).values({
    pollaId: polla.id,
    userId: adminUser.id,
    role: 'admin',
    inscriptionStatus: 'approved',
  })

  // Add all participants as polla members
  const participants = await db.select().from(schema.users).where(eq(schema.users.isSuperAdmin, false))
  if (participants.length > 0) {
    await db.insert(schema.pollaMembers).values(
      participants.map(u => ({
        pollaId: polla.id,
        userId: u.id,
        role: 'participant' as const,
        inscriptionStatus: 'pending' as const,
      }))
    ).onConflictDoNothing()
    console.log(`✅ Added ${participants.length} participant(s) to polla`)
  }

  // Migrate predictions
  const preds = await db.select({ id: schema.predictions.id }).from(schema.predictions).where(isNull(schema.predictions.pollaId))
  if (preds.length > 0) {
    for (const p of preds) {
      await db.update(schema.predictions).set({ pollaId: polla.id }).where(eq(schema.predictions.id, p.id))
    }
    console.log(`✅ Migrated ${preds.length} prediction(s)`)
  }

  // Migrate group predictions
  const gps = await db.select({ id: schema.groupPredictions.id }).from(schema.groupPredictions).where(isNull(schema.groupPredictions.pollaId))
  if (gps.length > 0) {
    for (const g of gps) {
      await db.update(schema.groupPredictions).set({ pollaId: polla.id }).where(eq(schema.groupPredictions.id, g.id))
    }
    console.log(`✅ Migrated ${gps.length} group prediction(s)`)
  }

  // Migrate special predictions
  const sps = await db.select({ id: schema.specialPredictions.id }).from(schema.specialPredictions).where(isNull(schema.specialPredictions.pollaId))
  if (sps.length > 0) {
    for (const s of sps) {
      await db.update(schema.specialPredictions).set({ pollaId: polla.id }).where(eq(schema.specialPredictions.id, s.id))
    }
    console.log(`✅ Migrated ${sps.length} special prediction(s)`)
  }

  // Migrate invitations
  const invs = await db.select({ id: schema.invitations.id }).from(schema.invitations).where(isNull(schema.invitations.pollaId))
  if (invs.length > 0) {
    for (const i of invs) {
      await db.update(schema.invitations).set({ pollaId: polla.id }).where(eq(schema.invitations.id, i.id))
    }
    console.log(`✅ Migrated ${invs.length} invitation(s)`)
  }

  // Seed default tournament config for this polla
  const configEntries = Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({
    pollaId: polla.id,
    key,
    value,
  }))
  await db.insert(schema.tournamentConfig).values(configEntries).onConflictDoNothing()
  console.log(`✅ Seeded ${configEntries.length} config entries`)

  await client.end()
  console.log('\n🎉 Migration complete!')
  console.log(`   Polla slug: mundial-2026`)
  console.log(`   Access at: /polla/mundial-2026/predictions`)
}

main().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
