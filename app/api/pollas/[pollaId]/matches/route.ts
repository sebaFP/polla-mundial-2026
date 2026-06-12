import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const config = await getPollaConfig(pollaId)
  const isPublic = config.polla_visibility === 'public'

  if (!isPublic) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const myRole = await getMemberRole(pollaId, session.userId)
    if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(matches)
  return NextResponse.json(rows)
}
