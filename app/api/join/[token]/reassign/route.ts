import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  invitations, pollas, users, pollaMembers,
  predictions, groupPredictions, specialPredictions, pollaAnswers,
} from '@/lib/db/schema'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params

  const [inv] = await db.select({
    userId: invitations.userId,
    pollaId: invitations.pollaId,
  }).from(invitations).where(
    and(
      eq(invitations.token, token),
      or(isNull(invitations.expiresAt), gt(invitations.expiresAt, new Date())),
    )
  ).limit(1)

  if (!inv) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 })
  }

  const currentUserId = session.userId
  const invitedUserId = inv.userId

  if (currentUserId === invitedUserId) {
    await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.token, token))
    return NextResponse.json({ ok: true, slug: await getPollaSlug(inv.pollaId) })
  }

  await db.transaction(async (tx) => {
    // Predictions: keep currentUser's where conflict, move the rest
    await tx.execute(sql`
      DELETE FROM predictions
      WHERE user_id = ${invitedUserId}
        AND (match_id, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)) IN (
          SELECT match_id, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)
          FROM predictions WHERE user_id = ${currentUserId}
        )
    `)
    await tx.update(predictions).set({ userId: currentUserId }).where(eq(predictions.userId, invitedUserId))

    // Group predictions: same conflict resolution
    await tx.execute(sql`
      DELETE FROM group_predictions
      WHERE user_id = ${invitedUserId}
        AND (group_name, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)) IN (
          SELECT group_name, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)
          FROM group_predictions WHERE user_id = ${currentUserId}
        )
    `)
    await tx.update(groupPredictions).set({ userId: currentUserId }).where(eq(groupPredictions.userId, invitedUserId))

    // Special predictions
    await tx.execute(sql`
      DELETE FROM special_predictions
      WHERE user_id = ${invitedUserId}
        AND (type, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)) IN (
          SELECT type, COALESCE(polla_id, '00000000-0000-0000-0000-000000000000'::uuid)
          FROM special_predictions WHERE user_id = ${currentUserId}
        )
    `)
    await tx.update(specialPredictions).set({ userId: currentUserId }).where(eq(specialPredictions.userId, invitedUserId))

    // Custom question answers
    await tx.execute(sql`
      DELETE FROM polla_answers
      WHERE user_id = ${invitedUserId}
        AND (question_id, polla_id) IN (
          SELECT question_id, polla_id FROM polla_answers WHERE user_id = ${currentUserId}
        )
    `)
    await tx.update(pollaAnswers).set({ userId: currentUserId }).where(eq(pollaAnswers.userId, invitedUserId))

    // Polla membership: update if no conflict, else delete old
    if (inv.pollaId) {
      const [existing] = await tx.select({ id: pollaMembers.id })
        .from(pollaMembers)
        .where(and(eq(pollaMembers.pollaId, inv.pollaId), eq(pollaMembers.userId, currentUserId)))
        .limit(1)

      if (existing) {
        await tx.delete(pollaMembers)
          .where(and(eq(pollaMembers.pollaId, inv.pollaId), eq(pollaMembers.userId, invitedUserId)))
      } else {
        await tx.update(pollaMembers)
          .set({ userId: currentUserId })
          .where(and(eq(pollaMembers.pollaId, inv.pollaId), eq(pollaMembers.userId, invitedUserId)))
      }
    }

    // Transfer invitation ownership and mark used
    await tx.update(invitations)
      .set({ userId: currentUserId, usedAt: new Date() })
      .where(eq(invitations.token, token))

    // Delete synthetic user — cascades remaining FK refs
    await tx.delete(users).where(eq(users.id, invitedUserId))
  })

  // Delete from Supabase Auth (outside transaction — best effort)
  await supabaseAdmin.auth.admin.deleteUser(invitedUserId).catch(console.error)

  return NextResponse.json({ ok: true, slug: await getPollaSlug(inv.pollaId) })
}

async function getPollaSlug(pollaId: string | null): Promise<string | null> {
  if (!pollaId) return null
  const [polla] = await db.select({ slug: pollas.slug }).from(pollas).where(eq(pollas.id, pollaId)).limit(1)
  return polla?.slug ?? null
}
