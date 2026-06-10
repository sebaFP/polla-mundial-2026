import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matches, pollaQuestions, pollaQuestionOptions } from '@/lib/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getMemberRole, getPollaById, getPollaConfig } from '@/lib/polla'
import { generatePredictionTemplate } from '@/lib/excel-template-generator'

type RouteContext = { params: Promise<{ pollaId: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pollaId } = await params
  const polla = await getPollaById(pollaId)
  if (!polla) return NextResponse.json({ error: 'Polla no encontrada' }, { status: 404 })

  const myRole = await getMemberRole(pollaId, session.userId)
  if (!myRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [config, allMatches, questions, questionOptions] = await Promise.all([
    getPollaConfig(pollaId),
    db.select().from(matches).orderBy(matches.matchDatetime),
    db.select().from(pollaQuestions)
      .where(and(eq(pollaQuestions.pollaId, pollaId), eq(pollaQuestions.enabled, true)))
      .orderBy(asc(pollaQuestions.order), asc(pollaQuestions.createdAt)),
    db.select().from(pollaQuestionOptions).orderBy(asc(pollaQuestionOptions.order)),
  ])

  const buf = generatePredictionTemplate({
    pollaName: polla.name,
    config,
    matches: allMatches,
    questions,
    questionOptions,
  })

  const safeName = polla.name.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
  const filename = `polla-${safeName}-planilla.xlsx`

  // Copy to plain ArrayBuffer (TS 5.7+ typed ArrayBufferLike compat)
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)

  return new Response(ab, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
