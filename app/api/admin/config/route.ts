import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/config' }, { status: 410 }) }
export async function PUT() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/config' }, { status: 410 }) }
