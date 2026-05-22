/**
 * Creates the first superadmin user in Supabase Auth + app users table.
 * Run: pnpm seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env.
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { users } from '../lib/db/schema'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrador'

  if (!email || !password) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be at least 8 characters')
    process.exit(1)
  }

  console.log(`👤 Creating superadmin: ${email}`)

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (error) {
    console.error('❌ Supabase Auth error:', error.message)
    process.exit(1)
  }

  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  await db.insert(users).values({
    id: data.user.id,
    name,
    email: email.trim().toLowerCase(),
    isSuperAdmin: true,
  }).onConflictDoNothing()

  await client.end()
  console.log(`✅ Superadmin created: ${name} <${email}>`)
  console.log('   Login at /login — then create your polla at /polla/create')
}

main().catch(err => {
  console.error('❌ Seed admin failed:', err)
  process.exit(1)
})
