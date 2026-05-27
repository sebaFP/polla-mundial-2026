import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollas, pollaMembers, tournamentConfig, users } from '@/lib/db/schema'
import { eq, inArray, and, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { slugify } from '@/lib/polla'
import { DEFAULT_CONFIG } from '@/lib/scoring'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all pollas where user is a member
  const memberships = await db.select({
    pollaId: pollaMembers.pollaId,
    role: pollaMembers.role,
  }).from(pollaMembers).where(eq(pollaMembers.userId, session.userId))

  if (memberships.length === 0) {
    return NextResponse.json([])
  }

  const pollaIds = memberships.map(m => m.pollaId)
  const roleMap = Object.fromEntries(memberships.map(m => [m.pollaId, m.role]))

  const allPollas = await db.select().from(pollas).where(inArray(pollas.id, pollaIds))

  // Get member counts per polla (only active participants or playing admins)
  const counts = await db.select({
    pollaId: pollaMembers.pollaId,
  }).from(pollaMembers).where(
    and(
      inArray(pollaMembers.pollaId, pollaIds),
      sql`(${pollaMembers.role} = 'participant' OR (${pollaMembers.role} = 'admin' AND ${pollaMembers.inscriptionStatus} = 'approved'))`
    )
  )

  const countMap: Record<string, number> = {}
  for (const c of counts) {
    countMap[c.pollaId] = (countMap[c.pollaId] ?? 0) + 1
  }

  const result = allPollas.map(p => ({
    ...p,
    myRole: roleMap[p.id],
    memberCount: countMap[p.id] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, competitionId, competitionCode, competitionName, competitionEmblem, competitionArea } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const baseSlug = slugify(name.trim())
  if (!baseSlug) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const slug = `${baseSlug}-${suffix}`

  const [polla] = await db.insert(pollas).values({
    name: name.trim(),
    slug,
    description: description?.trim() || null,
    createdBy: session.userId,
    competitionId:   competitionId   ?? 2000,
    competitionCode: competitionCode ?? 'WC',
    competitionName: competitionName ?? 'FIFA World Cup',
    competitionEmblem: competitionEmblem ?? null,
    competitionArea: competitionArea ?? 'World',
  }).returning()

  // Add creator as admin
  await db.insert(pollaMembers).values({
    pollaId: polla.id,
    userId: session.userId,
    role: 'admin',
    inscriptionStatus: 'approved',
  })

  // Seed default config for this polla
  const configEntries = Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({
    pollaId: polla.id,
    key,
    value,
  }))
  await db.insert(tournamentConfig).values(configEntries)

  // Ensure creator exists in users table (in case they registered externally)
  const [existing_user] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.userId))
  if (!existing_user) {
    return NextResponse.json({ error: 'Usuario no encontrado en DB' }, { status: 500 })
  }

  return NextResponse.json({ ...polla, myRole: 'admin', memberCount: 1 }, { status: 201 })
}
