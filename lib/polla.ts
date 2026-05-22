import { db } from '@/lib/db'
import { tournamentConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function isPollaOpen(): Promise<boolean> {
  const row = await db.select().from(tournamentConfig)
    .where(eq(tournamentConfig.key, 'polla_open'))
    .limit(1)
  return row.length === 0 || row[0].value !== 'false'
}
