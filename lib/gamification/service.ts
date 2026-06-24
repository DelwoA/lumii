// =============================================================================
// FILE: lib/gamification/service.ts
// WHAT THIS FILE DOES:
//   The "manager" for the rewards system. It ties together the smaller pieces
//   (points, ranks, streaks, trophies) and is what the rest of the app calls.
//
// THE MAIN JOBS:
//   - checkTrophies / runAwardChecks: after an action, see if any new trophies
//     were earned and whether the student ranked up, and return them to
//     celebrate. (Best-effort: a rewards failure never breaks the main action.)
//   - processAdherenceForDay + recomputeStreak: award adherent/perfect-day
//     points and rebuild the streak after a session.
//   - getAchievementsData / getGamificationSummary: read the numbers the
//     Achievements page and the sidebar footer show.
//
// HOW TO ADD A NEW TROPHY: add it to lib/gamification/trophies.ts; this file
//   then unlocks it automatically when its condition is met.
// =============================================================================
import "server-only";
import type { Rank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardXp } from "./award";
import { XP_RULES } from "./xp";
import { rankProgress, type RankProgress } from "./ranks";
import {
  computeAdherenceStreak,
  isAdherent,
  isPerfectDay,
  type PlannedDay,
} from "./streak";
import { TROPHIES, type TrophyStats } from "./trophies";
import type { Celebration, UnlockedTrophy } from "./celebration";

/** Aggregate stats used for trophy checks and the achievements view. */
async function getStats(userId: string): Promise<TrophyStats> {
  const [
    sessionsEnded,
    sessionsCompleted,
    quizzesCompleted,
    summariesGenerated,
    perfectDays,
    profile,
  ] = await Promise.all([
    prisma.studySession.count({ where: { userId, endedAt: { not: null } } }),
    prisma.studySession.count({
      where: { userId, endedAt: { not: null }, qualityScore: { not: null } },
    }),
    prisma.quizCompletion.count({ where: { userId } }),
    prisma.summary.count({ where: { userId } }),
    prisma.activityEvent.count({ where: { userId, type: "PERFECT_DAY" } }),
    prisma.gamificationProfile.findUnique({ where: { userId } }),
  ]);
  return {
    sessionsEnded,
    sessionsCompleted,
    quizzesCompleted,
    summariesGenerated,
    perfectDays,
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    totalXp: profile?.totalXp ?? 0,
  };
}

/** Idempotently upsert the trophy catalog into the DB (lazy seeding). */
async function ensureTrophies(): Promise<void> {
  await Promise.all(
    TROPHIES.map((t) =>
      prisma.trophy.upsert({
        where: { code: t.code },
        update: { name: t.name, description: t.description, icon: t.icon },
        create: {
          code: t.code,
          name: t.name,
          description: t.description,
          icon: t.icon,
          criteria: {},
        },
      }),
    ),
  );
}

/**
 * Unlock any newly-earned trophies (and grant their bonus XP). Returns the
 * trophies unlocked by THIS call (so the caller can celebrate them); returns an
 * empty list if none or on error. Best-effort: never throws into the caller.
 */
export async function checkTrophies(userId: string): Promise<UnlockedTrophy[]> {
  const unlocked: UnlockedTrophy[] = [];
  try {
    const stats = await getStats(userId);
    const earned = TROPHIES.filter((t) => t.check(stats));
    if (earned.length === 0) return unlocked;

    await ensureTrophies();
    const rows = await prisma.trophy.findMany({
      where: { code: { in: earned.map((t) => t.code) } },
      select: { id: true, code: true },
    });
    const already = await prisma.userTrophy.findMany({
      where: { userId, trophyId: { in: rows.map((r) => r.id) } },
      select: { trophyId: true },
    });
    const have = new Set(already.map((a) => a.trophyId));

    for (const row of rows) {
      if (have.has(row.id)) continue;
      const def = earned.find((e) => e.code === row.code);
      if (!def) continue;
      try {
        await prisma.userTrophy.create({ data: { userId, trophyId: row.id } });
      } catch {
        continue; // concurrent unlock; the unique index already recorded it
      }
      await awardXp({
        userId,
        type: "TROPHY_UNLOCKED",
        requestedXp: def.xp,
        idempotencyKey: `trophy:${userId}:${def.code}`,
        sourceType: "trophy",
        sourceId: def.code,
        payload: { code: def.code },
      });
      unlocked.push({
        code: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        xp: def.xp,
      });
    }
  } catch {
    // Gamification is non-critical; swallow and return whatever unlocked so far.
  }
  return unlocked;
}

/** The user's current rank (BRONZE if no profile yet). */
export async function getCurrentRank(userId: string): Promise<Rank> {
  const profile = await prisma.gamificationProfile.findUnique({
    where: { userId },
    select: { rank: true },
  });
  return profile?.rank ?? "BRONZE";
}

/**
 * Run the post-award checks for a user action and collect what to celebrate:
 * newly-unlocked trophies plus a rank-up relative to `rankBefore` (which the
 * caller captured before its awards). Best-effort and safe to ignore.
 */
export async function runAwardChecks(
  userId: string,
  rankBefore: Rank,
): Promise<Celebration> {
  const trophies = await checkTrophies(userId);
  const rankAfter = await getCurrentRank(userId);
  return { trophies, rankUp: rankAfter !== rankBefore ? rankAfter : null };
}

/** Rebuild the adherence streak projection from all planned days. */
export async function recomputeStreak(userId: string): Promise<void> {
  const rows = await prisma.scheduledSession.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    select: { plannedLocalDate: true, targetDurationSec: true, status: true },
  });

  const byDay = new Map<string, { planned: number; completed: number }>();
  for (const r of rows) {
    const entry = byDay.get(r.plannedLocalDate) ?? { planned: 0, completed: 0 };
    entry.planned += r.targetDurationSec;
    if (r.status === "COMPLETED") entry.completed += r.targetDurationSec;
    byDay.set(r.plannedLocalDate, entry);
  }

  const days: PlannedDay[] = [...byDay].map(([date, v]) => ({
    date,
    plannedMinutes: v.planned / 60,
    completedMinutes: v.completed / 60,
  }));
  const streak = computeAdherenceStreak(days);

  const existing = await prisma.gamificationProfile.findUnique({
    where: { userId },
    select: { longestStreak: true },
  });
  await prisma.gamificationProfile.upsert({
    where: { userId },
    update: {
      currentStreak: streak.current,
      longestStreak: Math.max(streak.longest, existing?.longestStreak ?? 0),
      lastAdherentDay: streak.lastAdherentDay,
    },
    create: {
      userId,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      lastAdherentDay: streak.lastAdherentDay,
    },
  });
}

/**
 * After a session completes for a planned day, award adherent/perfect-day XP
 * (idempotent per user+date) and rebuild the streak projection.
 */
export async function processAdherenceForDay(
  userId: string,
  date: string,
): Promise<void> {
  const rows = await prisma.scheduledSession.findMany({
    where: { userId, plannedLocalDate: date, status: { not: "CANCELLED" } },
    select: { targetDurationSec: true, status: true },
  });

  let planned = 0;
  let completed = 0;
  for (const r of rows) {
    planned += r.targetDurationSec;
    if (r.status === "COMPLETED") completed += r.targetDurationSec;
  }
  const day: PlannedDay = {
    date,
    plannedMinutes: planned / 60,
    completedMinutes: completed / 60,
  };

  if (isAdherent(day)) {
    await awardXp({
      userId,
      type: "ADHERENT_DAY",
      requestedXp: XP_RULES.ADHERENT_DAY,
      idempotencyKey: `adherent-day:${userId}:${date}`,
      sourceType: "adherence",
      sourceId: date,
    });
  }
  if (isPerfectDay(day)) {
    await awardXp({
      userId,
      type: "PERFECT_DAY",
      requestedXp: XP_RULES.PERFECT_DAY,
      idempotencyKey: `perfect-day:${userId}:${date}`,
      sourceType: "adherence",
      sourceId: date,
    });
  }

  await recomputeStreak(userId);
}

export interface AchievementTrophyView {
  code: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  unlocked: boolean;
  unlockedAtISO: string | null;
}

export interface AchievementsData {
  totalXp: number;
  rank: Rank;
  progress: RankProgress;
  currentStreak: number;
  longestStreak: number;
  trophies: AchievementTrophyView[];
  unlockedCount: number;
}

/** Everything the Achievements page renders. */
export async function getAchievementsData(
  userId: string,
): Promise<AchievementsData> {
  await ensureTrophies();
  const [profile, userTrophies] = await Promise.all([
    prisma.gamificationProfile.findUnique({ where: { userId } }),
    prisma.userTrophy.findMany({
      where: { userId },
      include: { trophy: { select: { code: true } } },
    }),
  ]);

  const unlocked = new Map(
    userTrophies.map((ut) => [ut.trophy.code, ut.unlockedAt]),
  );
  const totalXp = profile?.totalXp ?? 0;
  const trophies: AchievementTrophyView[] = TROPHIES.map((t) => ({
    code: t.code,
    name: t.name,
    description: t.description,
    icon: t.icon,
    xp: t.xp,
    unlocked: unlocked.has(t.code),
    unlockedAtISO: unlocked.get(t.code)?.toISOString() ?? null,
  }));

  return {
    totalXp,
    rank: profile?.rank ?? "BRONZE",
    progress: rankProgress(totalXp),
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    trophies,
    unlockedCount: trophies.filter((t) => t.unlocked).length,
  };
}

export interface GamificationSummary {
  totalXp: number;
  rank: Rank;
  currentStreak: number;
  progress: RankProgress;
}

/** Compact projection for the sidebar footer / dashboard. */
export async function getGamificationSummary(
  userId: string,
): Promise<GamificationSummary> {
  const profile = await prisma.gamificationProfile.findUnique({
    where: { userId },
  });
  const totalXp = profile?.totalXp ?? 0;
  return {
    totalXp,
    rank: profile?.rank ?? "BRONZE",
    currentStreak: profile?.currentStreak ?? 0,
    progress: rankProgress(totalXp),
  };
}
