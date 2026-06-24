// =============================================================================
// FILE: lib/gamification/award.ts
// WHAT THIS FILE DOES:
//   The one place that actually GIVES a student points. Every reward goes
//   through awardXp(). It does three things in a single safe step (a database
//   "transaction", which means all-or-nothing):
//     1. Writes one row in the ActivityEvent table (the points "ledger", like a
//        bank statement line).
//     2. Applies the daily points cap.
//     3. Updates the running total and the rank on the GamificationProfile.
//
// TWO IMPORTANT SAFEGUARDS:
//   - idempotencyKey: a unique label per award so the SAME reward can never be
//     given twice (even on a double click or a retry).
//   - The catch at the bottom handles a rare "two things happened at once" case
//     so points are never accidentally lost or doubled.
//
// This keeps the invariant: total points == the sum of all ledger rows.
// =============================================================================
import "server-only";
import { Prisma } from "@prisma/client";
import type { EventType, Rank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rankForXp } from "./ranks";
import { applyDailyCap } from "./xp";

export interface AwardResult {
  xpAwarded: number;
  totalXp: number;
  rank: Rank;
  rankedUp: boolean;
  duplicate: boolean;
}

/**
 * Award XP idempotently. Writes one ActivityEvent (the XP ledger) and updates
 * the GamificationProfile aggregate in a single transaction. Re-running with
 * the same idempotencyKey is a no-op. Applies the daily XP cap and recomputes
 * rank. The aggregate stays equal to SUM(ActivityEvent.xpDelta).
 */
export async function awardXp(opts: {
  userId: string;
  type: EventType;
  requestedXp: number;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
  payload?: Prisma.InputJsonValue;
}): Promise<AwardResult> {
  const { userId, type, requestedXp, idempotencyKey, sourceType, sourceId, payload } =
    opts;

  const runAward = (): Promise<AwardResult> =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.activityEvent.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      const profile =
        (await tx.gamificationProfile.findUnique({ where: { userId } })) ??
        (await tx.gamificationProfile.create({ data: { userId } }));

      if (existing) {
        return {
          xpAwarded: 0,
          totalXp: profile.totalXp,
          rank: profile.rank,
          rankedUp: false,
          duplicate: true,
        };
      }

      // Daily cap based on positive XP already earned today (UTC day).
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const todays = await tx.activityEvent.aggregate({
        where: { userId, createdAt: { gte: startOfDay }, xpDelta: { gt: 0 } },
        _sum: { xpDelta: true },
      });
      const xpAwarded = applyDailyCap(todays._sum.xpDelta ?? 0, requestedXp);

      await tx.activityEvent.create({
        data: { userId, type, xpDelta: xpAwarded, idempotencyKey, sourceType, sourceId, payload },
      });

      const totalXp = profile.totalXp + xpAwarded;
      const rank = rankForXp(totalXp);
      const rankedUp = rank !== profile.rank;
      const updated = await tx.gamificationProfile.update({
        where: { userId },
        data: { totalXp, rank },
      });

      return {
        xpAwarded,
        totalXp: updated.totalXp,
        rank: updated.rank,
        rankedUp,
        duplicate: false,
      };
    });

  try {
    return await runAward();
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") {
      throw e;
    }
    // A unique conflict has two causes. If OUR event now exists, a concurrent
    // award with the same idempotency key won the insert: a genuine no-op
    // duplicate (Postgres prevented the double XP). Otherwise the conflict was a
    // concurrent first-time GamificationProfile create — our event was never
    // written — so retry now that the profile exists.
    const existing = await prisma.activityEvent.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (!existing) return runAward();
    const profile = await prisma.gamificationProfile.findUnique({
      where: { userId },
    });
    return {
      xpAwarded: 0,
      totalXp: profile?.totalXp ?? 0,
      rank: profile?.rank ?? "BRONZE",
      rankedUp: false,
      duplicate: true,
    };
  }
}
