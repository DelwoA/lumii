// =============================================================================
// FILE: lib/progress/service.ts
// WHAT THIS FILE DOES:
//   Gathers everything the Progress page shows. It reads the database and works
//   out the totals (study time, sessions, quizzes, longest streak) and the data
//   for the charts (study minutes over recent days, weekly adherence, points
//   growth) and the study-activity calendar. All of it is owner-scoped to the
//   signed-in user. The shapes it returns are described in ./types.ts.
// =============================================================================
import "server-only";
import { prisma } from "@/lib/prisma";
import { localDateString } from "@/lib/timetable/dates";
import type { ProgressData } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD from a Date's own (server-local) calendar components. */
function localKey(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A short "Jun 10" label from a YYYY-MM-DD string. */
function shortLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Monday (local) of the week containing `dt`. */
function mondayOf(dt: Date): Date {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  return x;
}

function weekStartKey(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localKey(mondayOf(new Date(y, m - 1, d)));
}

/** The last `n` local dates (YYYY-MM-DD) ending today, in the user's timezone. */
function lastNDates(n: number, tz: string): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(localDateString(new Date(now - i * DAY_MS), tz));
  }
  return out;
}

export async function getProgressData(
  userId: string,
  timezone: string,
): Promise<ProgressData> {
  const tz = timezone || "UTC";
  const windowStart = new Date(Date.now() - 84 * DAY_MS);
  const xpWindowStart = new Date(Date.now() - 30 * DAY_MS);

  const [sessions, events, xpBefore, scheduled, totalAgg, totalQuizzes, profile] =
    await Promise.all([
      prisma.studySession.findMany({
        where: {
          userId,
          endedAt: { not: null },
          startedAt: { gte: windowStart },
        },
        select: { startedAt: true, actualDurationSec: true },
      }),
      prisma.activityEvent.findMany({
        where: { userId, xpDelta: { gt: 0 }, createdAt: { gte: xpWindowStart } },
        select: { createdAt: true, xpDelta: true },
      }),
      prisma.activityEvent.aggregate({
        where: { userId, xpDelta: { gt: 0 }, createdAt: { lt: xpWindowStart } },
        _sum: { xpDelta: true },
      }),
      prisma.scheduledSession.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: { plannedLocalDate: true, targetDurationSec: true, status: true },
      }),
      prisma.studySession.aggregate({
        where: { userId, endedAt: { not: null } },
        _sum: { actualDurationSec: true },
        _count: true,
      }),
      prisma.quizCompletion.count({ where: { userId } }),
      prisma.gamificationProfile.findUnique({ where: { userId } }),
    ]);

  // Study seconds bucketed by the user's local date.
  const studyByDate = new Map<string, number>();
  for (const s of sessions) {
    const key = localDateString(s.startedAt, tz);
    studyByDate.set(key, (studyByDate.get(key) ?? 0) + (s.actualDurationSec ?? 0));
  }

  const dailyStudy = lastNDates(14, tz).map((date) => ({
    date,
    label: shortLabel(date),
    minutes: Math.round((studyByDate.get(date) ?? 0) / 60),
  }));

  const activityCalendar = lastNDates(84, tz).map((date) => ({
    date,
    minutes: Math.round((studyByDate.get(date) ?? 0) / 60),
  }));

  // XP earned per local day, then accumulated across the 30-day window.
  const xpByDate = new Map<string, number>();
  for (const e of events) {
    const key = localDateString(e.createdAt, tz);
    xpByDate.set(key, (xpByDate.get(key) ?? 0) + e.xpDelta);
  }
  let running = xpBefore._sum.xpDelta ?? 0;
  const xpCumulative = lastNDates(30, tz).map((date) => {
    running += xpByDate.get(date) ?? 0;
    return { date, label: shortLabel(date), xp: running };
  });

  // Weekly adherence over planned target minutes.
  const weekMap = new Map<string, { planned: number; completed: number }>();
  for (const s of scheduled) {
    const key = weekStartKey(s.plannedLocalDate);
    const entry = weekMap.get(key) ?? { planned: 0, completed: 0 };
    entry.planned += s.targetDurationSec;
    if (s.status === "COMPLETED") entry.completed += s.targetDurationSec;
    weekMap.set(key, entry);
  }
  const thisMonday = mondayOf(new Date());
  const weeklyAdherence = [];
  for (let i = 5; i >= 0; i--) {
    const wkKey = localKey(new Date(thisMonday.getTime() - i * 7 * DAY_MS));
    const e = weekMap.get(wkKey) ?? { planned: 0, completed: 0 };
    weeklyAdherence.push({
      week: shortLabel(wkKey),
      pct: e.planned > 0 ? Math.round((e.completed / e.planned) * 100) : 0,
    });
  }

  return {
    totals: {
      studySeconds: totalAgg._sum.actualDurationSec ?? 0,
      sessions: totalAgg._count,
      quizzes: totalQuizzes,
      currentStreak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
    },
    dailyStudy,
    xpCumulative,
    weeklyAdherence,
    activityCalendar,
  };
}
