import { NextResponse } from 'next/server'
export async function PATCH() { return NextResponse.json({ error: 'Use /api/pollas/[pollaId]/members' }, { status: 410 }) }
