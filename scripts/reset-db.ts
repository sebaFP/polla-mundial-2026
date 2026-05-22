/**
 * Wipes the entire database and all Supabase Auth users.
 * Run: pnpm db:reset
 *
 * After this: pnpm db:push → pnpm seed → pnpm seed:admin
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function deleteAllAuthUsers() {
  console.log('🔑 Deleting Supabase Auth users...')
  let total = 0
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    if (!data.users.length) break

    await Promise.all(data.users.map(u => supabaseAdmin.auth.admin.deleteUser(u.id)))
    total += data.users.length
    console.log(`  Deleted ${total} users so far...`)

    if (data.users.length < perPage) break
    page++
  }

  console.log(`✅ Deleted ${total} auth users`)
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  console.log('💣 Resetting database...')

  // Drop all app tables in dependency order
  await db.execute(sql`
    DROP TABLE IF EXISTS
      special_predictions,
      group_predictions,
      predictions,
      invitations,
      group_standings,
      tournament_config,
      matches,
      users
    CASCADE
  `)
  console.log('✅ All tables dropped')

  await deleteAllAuthUsers()

  await client.end()
  console.log('')
  console.log('🎉 Done. Now run:')
  console.log('   pnpm db:push     → recreate schema')
  console.log('   pnpm seed        → seed 104 matches + config')
  console.log('   pnpm seed:admin  → create first admin user')
}

main().catch(err => {
  console.error('❌ Reset failed:', err)
  process.exit(1)
})
