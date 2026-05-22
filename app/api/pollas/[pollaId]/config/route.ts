import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentConfig } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { DEFAULT_CONFIG } from '@/lib/scoring'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = await getPollaConfig(pollaId)
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  if (!(await getPollaById(pollaId))) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: Record<string, string> = await req.json()

  for (const [key, value] of Object.entries(updates)) {
    if (!(key in DEFAULT_CONFIG)) continue // only allow known keys
    const existing = await db.select({ id: tournamentConfig.id })
      .from(tournamentConfig)
      .where(and(eq(tournamentConfig.pollaId, pollaId), eq(tournamentConfig.key, key)))
      .limit(1)

    if (existing.length > 0) {
      await db.update(tournamentConfig)
        .set({ value: String(value) })
        .where(and(eq(tournamentConfig.pollaId, pollaId), eq(tournamentConfig.key, key)))
    } else {
      await db.insert(tournamentConfig).values({ pollaId, key, value: String(value) })
    }
  }

  return NextResponse.json({ ok: true })
}
