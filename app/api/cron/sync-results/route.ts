import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/lib/football-data/sync'

export async function GET(req: NextRequest) {
  // Protect with secret - works for both Vercel cron and external cron services
  const cronSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')

  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isExternalCron = cronSecret === process.env.CRON_SECRET

  if (!isVercelCron && !isExternalCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncResults()
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...result,
  })
}

// Also allow POST for manual trigger from admin panel
export async function POST(req: NextRequest) {
  const { secret } = await req.json().catch(() => ({ secret: '' }))
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await syncResults()
  return NextResponse.json({ ok: true, ...result })
}
