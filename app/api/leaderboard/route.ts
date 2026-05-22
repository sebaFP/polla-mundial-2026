import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/leaderboard' }, { status: 410 })
}
