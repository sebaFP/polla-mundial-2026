import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { DEFAULT_CONFIG } from '@/lib/scoring'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(tournamentConfig)
  const config = { ...DEFAULT_CONFIG, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: Record<string, string> = await req.json()

  for (const [key, value] of Object.entries(updates)) {
    const existing = await db.select().from(tournamentConfig).where(eq(tournamentConfig.key, key)).limit(1)
    if (existing.length > 0) {
      await db.update(tournamentConfig).set({ value: String(value) }).where(eq(tournamentConfig.key, key))
    } else {
      await db.insert(tournamentConfig).values({ key, value: String(value) })
    }
  }

  return NextResponse.json({ ok: true })
}
