/**
 * Applies multi-polla schema changes directly via SQL.
 * Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS).
 * Run: npx tsx scripts/apply-schema.ts
 */
import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { prepare: false })

  console.log('🔧 Applying schema changes...\n')

  const steps: Array<{ name: string; sql: string }> = [
    // 1. Add isSuperAdmin to users
    {
      name: 'Add is_super_admin to users',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false`,
    },

    // 2. Remove old columns from users (safe drop)
    {
      name: 'Drop role from users',
      sql: `ALTER TABLE users DROP COLUMN IF EXISTS role`,
    },
    {
      name: 'Drop inscription_status from users',
      sql: `ALTER TABLE users DROP COLUMN IF EXISTS inscription_status`,
    },
    {
      name: 'Drop inscription_notes from users',
      sql: `ALTER TABLE users DROP COLUMN IF EXISTS inscription_notes`,
    },

    // 3. Create pollas table
    {
      name: 'Create pollas table',
      sql: `
        CREATE TABLE IF NOT EXISTS pollas (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text,
          created_by uuid NOT NULL REFERENCES users(id),
          created_at timestamp NOT NULL DEFAULT NOW(),
          is_active boolean NOT NULL DEFAULT true
        )
      `,
    },

    // 4. Create polla_members table
    {
      name: 'Create polla_members table',
      sql: `
        CREATE TABLE IF NOT EXISTS polla_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          polla_id uuid NOT NULL REFERENCES pollas(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'participant',
          inscription_status text NOT NULL DEFAULT 'pending',
          inscription_notes text,
          joined_at timestamp NOT NULL DEFAULT NOW(),
          UNIQUE(polla_id, user_id)
        )
      `,
    },

    // 5. Add polla_id to invitations
    {
      name: 'Add polla_id to invitations',
      sql: `ALTER TABLE invitations ADD COLUMN IF NOT EXISTS polla_id uuid REFERENCES pollas(id) ON DELETE CASCADE`,
    },

    // 6. Add polla_id to predictions
    {
      name: 'Add polla_id to predictions',
      sql: `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS polla_id uuid REFERENCES pollas(id) ON DELETE CASCADE`,
    },
    {
      name: 'Drop old unique on predictions',
      sql: `ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_match_id_unique`,
    },
    {
      name: 'Add new unique on predictions (userId, matchId, pollaId)',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'predictions_user_id_match_id_polla_id_unique'
          ) THEN
            ALTER TABLE predictions ADD CONSTRAINT predictions_user_id_match_id_polla_id_unique UNIQUE (user_id, match_id, polla_id);
          END IF;
        END $$
      `,
    },

    // 7. Add polla_id to group_predictions
    {
      name: 'Add polla_id to group_predictions',
      sql: `ALTER TABLE group_predictions ADD COLUMN IF NOT EXISTS polla_id uuid REFERENCES pollas(id) ON DELETE CASCADE`,
    },
    {
      name: 'Drop old unique on group_predictions',
      sql: `ALTER TABLE group_predictions DROP CONSTRAINT IF EXISTS group_predictions_user_id_group_name_unique`,
    },
    {
      name: 'Add new unique on group_predictions',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'group_predictions_user_id_group_name_polla_id_unique'
          ) THEN
            ALTER TABLE group_predictions ADD CONSTRAINT group_predictions_user_id_group_name_polla_id_unique UNIQUE (user_id, group_name, polla_id);
          END IF;
        END $$
      `,
    },

    // 8. Add polla_id to special_predictions
    {
      name: 'Add polla_id to special_predictions',
      sql: `ALTER TABLE special_predictions ADD COLUMN IF NOT EXISTS polla_id uuid REFERENCES pollas(id) ON DELETE CASCADE`,
    },
    {
      name: 'Drop old unique on special_predictions',
      sql: `ALTER TABLE special_predictions DROP CONSTRAINT IF EXISTS special_predictions_user_id_type_unique`,
    },
    {
      name: 'Add new unique on special_predictions',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'special_predictions_user_id_type_polla_id_unique'
          ) THEN
            ALTER TABLE special_predictions ADD CONSTRAINT special_predictions_user_id_type_polla_id_unique UNIQUE (user_id, type, polla_id);
          END IF;
        END $$
      `,
    },

    // 9. Migrate tournament_config from key-only PK to id PK + polla_id
    {
      name: 'Add id column to tournament_config (if not exists)',
      sql: `ALTER TABLE tournament_config ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid()`,
    },
    {
      name: 'Add polla_id to tournament_config',
      sql: `ALTER TABLE tournament_config ADD COLUMN IF NOT EXISTS polla_id uuid REFERENCES pollas(id) ON DELETE CASCADE`,
    },
    {
      name: 'Drop old PK on tournament_config key',
      sql: `ALTER TABLE tournament_config DROP CONSTRAINT IF EXISTS tournament_config_pkey`,
    },
    {
      name: 'Set id NOT NULL in tournament_config',
      sql: `UPDATE tournament_config SET id = gen_random_uuid() WHERE id IS NULL`,
    },
    {
      name: 'Add PK on tournament_config id',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tournament_config_pkey'
          ) THEN
            ALTER TABLE tournament_config ADD PRIMARY KEY (id);
          END IF;
        END $$
      `,
    },
    {
      name: 'Add unique on (polla_id, key) in tournament_config',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tournament_config_polla_id_key_unique'
          ) THEN
            ALTER TABLE tournament_config ADD CONSTRAINT tournament_config_polla_id_key_unique UNIQUE (polla_id, key);
          END IF;
        END $$
      `,
    },
  ]

  for (const step of steps) {
    try {
      await sql.unsafe(step.sql)
      console.log(`✅ ${step.name}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Ignore "already exists" type errors
      if (msg.includes('already exists') || msg.includes('does not exist')) {
        console.log(`⏭️  ${step.name} (skipped: ${msg.split('\n')[0]})`)
      } else {
        console.error(`❌ ${step.name}: ${msg}`)
        throw err
      }
    }
  }

  await sql.end()
  console.log('\n✅ Schema applied!')
  console.log('   Run next: npx tsx scripts/migrate-to-multi-polla.ts')
}

main().catch(err => {
  console.error('❌ Schema apply failed:', err)
  process.exit(1)
})
