import "server-only";
import type { EventType, Prisma, Rank } from "@prisma/client";
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

  return prisma.$transaction(async (tx) => {
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
}
