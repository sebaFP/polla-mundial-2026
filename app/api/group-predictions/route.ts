import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/group-predictions' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/group-predictions' }, { status: 410 }) }
