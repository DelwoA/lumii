// =============================================================================
// FILE: lib/mood/service.ts
// WHAT THIS FILE DOES:
//   The database side of the mood feature. Two jobs:
//     - purgeExpiredMoodCheckins: lazily deletes old check-ins whose retention
//       time has passed (newer ones are kept until the student deletes them).
//     - getMoodSummary: counts the last 14 days of check-ins by feeling and asks
//       lib/mood/summary.ts to turn those counts into a friendly headline.
//   It is "server-only" because it touches the database directly.
// =============================================================================
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  MOOD_WINDOW_DAYS,
  buildMoodSummary,
  type MoodSummary,
} from "@/lib/mood/summary";

/**
 * Lazily delete check-ins whose retention window has passed. New free-text
 * check-ins are stored with `expiresAt = null` and kept until the user deletes
 * them; legacy label-only rows carry an `expiresAt` and are purged on access
 * once past due (honouring the original 30-day deletion promise). A `lte`
 * filter naturally excludes the kept (null) rows.
 */
export async function purgeExpiredMoodCheckins(userId: string): Promise<void> {
  await prisma.moodCheckin.deleteMany({
    where: { userId, expiresAt: { lte: new Date() } },
  });
}

/**
 * Compute the deterministic "average feeling" over the recent window from a
 * dedicated aggregation, independent of the (capped) display list so a heavy
 * check-in week cannot undercount the summary. Only valence-bearing check-ins
 * count; legacy label-only rows (null valence) are excluded.
 */
export async function getMoodSummary(
  userId: string,
): Promise<MoodSummary | null> {
  const cutoff = new Date(Date.now() - MOOD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const grouped = await prisma.moodCheckin.groupBy({
    by: ["valence"],
    where: { userId, valence: { not: null }, createdAt: { gte: cutoff } },
    _count: { _all: true },
  });

  let pos = 0;
  let neu = 0;
  let neg = 0;
  for (const g of grouped) {
    const n = g._count._all;
    if (g.valence === "POSITIVE") pos += n;
    else if (g.valence === "NEGATIVE") neg += n;
    else neu += n;
  }
  return buildMoodSummary({ pos, neu, neg });
}
