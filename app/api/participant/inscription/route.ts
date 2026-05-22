import { NextResponse } from 'next/server'
export async function POST() { return NextResponse.json({ error: 'Inscription is now per-polla' }, { status: 410 }) }
