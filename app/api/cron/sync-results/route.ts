import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/lib/football-data/sync'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')

  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isExternalCron = cronSecret === process.env.CRON_SECRET

  if (!isVercelCron && !isExternalCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncResults()
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...result })
}

// Manual trigger from admin panel — accepts CRON_SECRET or a valid admin/superadmin session
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const secret = body?.secret ?? ''

  if (secret !== process.env.CRON_SECRET) {
    // Fall back to session-based auth for admin panel use
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await syncResults()
  return NextResponse.json({ ok: true, ...result })
}
