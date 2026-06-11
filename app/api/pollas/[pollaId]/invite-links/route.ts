import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pollaInviteLinks } from '@/lib/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole } from '@/lib/polla'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const role = await getMemberRole(pollaId, session.userId)
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const links = await db.select().from(pollaInviteLinks)
    .where(
      and(
        eq(pollaInviteLinks.pollaId, pollaId),
        or(isNull(pollaInviteLinks.expiresAt), gt(pollaInviteLinks.expiresAt, new Date()))
      )
    )

  return NextResponse.json(links)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const role = await getMemberRole(pollaId, session.userId)
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const label: string | null = body.label?.trim() || null

  const [link] = await db.insert(pollaInviteLinks).values({
    pollaId,
    label,
    createdBy: session.userId,
  }).returning()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({ ...link, url: `${appUrl}/invite/${link.token}` }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const role = await getMemberRole(pollaId, session.userId)
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

  await db.delete(pollaInviteLinks)
    .where(and(eq(pollaInviteLinks.token, token), eq(pollaInviteLinks.pollaId, pollaId)))

  return NextResponse.json({ ok: true })
}
