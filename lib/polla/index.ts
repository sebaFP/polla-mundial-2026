import { db } from '@/lib/db'
import { pollas, pollaMembers, tournamentConfig } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { DEFAULT_CONFIG, type Config } from '@/lib/scoring'

export async function getPollaBySlug(slug: string) {
  const [polla] = await db.select().from(pollas).where(eq(pollas.slug, slug)).limit(1)
  return polla ?? null
}

export async function getPollaById(pollaId: string) {
  const [polla] = await db.select().from(pollas).where(eq(pollas.id, pollaId)).limit(1)
  return polla ?? null
}

export async function getMemberRole(pollaId: string, userId: string): Promise<'admin' | 'participant' | null> {
  const [member] = await db.select({ role: pollaMembers.role })
    .from(pollaMembers)
    .where(and(eq(pollaMembers.pollaId, pollaId), eq(pollaMembers.userId, userId)))
    .limit(1)
  return (member?.role as 'admin' | 'participant') ?? null
}

export async function isPollaOpen(pollaId: string): Promise<boolean> {
  const [row] = await db.select({ value: tournamentConfig.value })
    .from(tournamentConfig)
    .where(and(eq(tournamentConfig.pollaId, pollaId), eq(tournamentConfig.key, 'polla_open')))
    .limit(1)
  return !row || row.value !== 'false'
}

export async function getPollaConfig(pollaId: string): Promise<Config> {
  const rows = await db.select().from(tournamentConfig)
    .where(eq(tournamentConfig.pollaId, pollaId))
  return { ...DEFAULT_CONFIG, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}
