/**
 * Create an admin user in the database.
 * Usage: pnpm tsx scripts/create-admin.ts "Nombre" "email@ejemplo.com" "contraseña"
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function main() {
  const [, , name, email, password] = process.argv

  if (!name || !email || !password) {
    console.error('Uso: pnpm tsx scripts/create-admin.ts "Nombre" "email@ejemplo.com" "contraseña"')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('❌ Contraseña mínimo 8 caracteres')
    process.exit(1)
  }

  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    console.error(`❌ Email ${email} ya existe`)
    await client.end()
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const created = await db.insert(users).values({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'admin',
    passwordHash,
  }).returning({ id: users.id, name: users.name, email: users.email })

  console.log(`✅ Admin creado: ${created[0].name} <${created[0].email}> (id: ${created[0].id})`)
  await client.end()
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
