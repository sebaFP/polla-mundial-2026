import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/members' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/admins/invite' }, { status: 410 }) }
export async function PATCH() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/members' }, { status: 410 }) }
export async function DELETE() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/members' }, { status: 410 }) }
