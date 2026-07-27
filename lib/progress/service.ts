import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localDateString } from "@/lib/timetable/dates";
import type {
  ProgressData,
  ProgressFilters,
  SessionHistoryEntry,
} from "./types";
import type { SessionQualityBreakdown } from "@/lib/gamification/session-quality";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

const SESSION_SELECT = {
  id: true,
  title: true,
  goal: true,
  startedAt: true,
  endedAt: true,
  actualDurationSec: true,
  targetDurationSec: true,
  scoreStatus: true,
  qualityScore: true,
  qualityVersion: true,
  qualityBreakdown: true,
  goalCompleted: true,
  reflection: true,
  autoClosed: true,
  subject: { select: { name: true } },
  topic: { select: { name: true } },
} as const;

type SessionRow = Prisma.StudySessionGetPayload<{
  select: typeof SESSION_SELECT;
}>;

function toHistory(row: SessionRow): SessionHistoryEntry {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    subjectName: row.subject?.name ?? null,
    topicName: row.topic?.name ?? null,
    startedAtISO: row.startedAt.toISOString(),
    endedAtISO: (row.endedAt ?? row.startedAt).toISOString(),
    durationSec: row.actualDurationSec ?? 0,
    targetDurationSec: row.targetDurationSec,
    scoreStatus: row.scoreStatus,
    qualityScore: row.qualityScore,
    qualityVersion: row.qualityVersion,
    qualityBreakdown:
      (row.qualityBreakdown as SessionQualityBreakdown | null) ?? null,
    goalCompleted: row.goalCompleted,
    reflection: row.reflection,
    autoClosed: row.autoClosed,
  };
}

function shortLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return value.toISOString().slice(0, 10);
}

function mondayKey(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
}

function lastNDates(n: number, timezone: string): string[] {
  const today = localDateString(new Date(), timezone);
  return Array.from({ length: n }, (_, index) =>
    shiftDate(today, index - n + 1),
  );
}

function localMidnightUtc(
  value: string | undefined,
  timezone: string,
): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 3; iteration++) {
    const values = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const observed = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );
    guess += target - observed;
  }
  return new Date(guess);
}

export function sessionRangeWhere(
  filters: ProgressFilters,
  timezone = "UTC",
): Prisma.DateTimeFilter | undefined {
  if (filters.range === "all") return undefined;
  if (filters.range === "custom") {
    const gte = localMidnightUtc(filters.from, timezone);
    const nextDate = filters.to ? shiftDate(filters.to, 1) : undefined;
    const nextMidnight = localMidnightUtc(nextDate, timezone);
    const lte = nextMidnight ? new Date(nextMidnight.getTime() - 1) : undefined;
    return gte || lte ? { gte, lte } : undefined;
  }
  return {
    gte: new Date(Date.now() - (filters.range === "30d" ? 30 : 90) * DAY_MS),
  };
}

function normalizeFilters(filters?: Partial<ProgressFilters>): ProgressFilters {
  const range =
    filters?.range === "30d" ||
    filters?.range === "all" ||
    filters?.range === "custom"
      ? filters.range
      : "90d";
  return {
    range,
    from: filters?.from,
    to: filters?.to,
    page: Math.max(1, Math.floor(filters?.page ?? 1)),
    sessionId: filters?.sessionId,
  };
}

export async function getProgressData(
  userId: string,
  timezone: string,
  incomingFilters?: Partial<ProgressFilters>,
): Promise<ProgressData> {
  const timezoneSafe = timezone || "UTC";
  const filters = normalizeFilters(incomingFilters);
  const startedAt = sessionRangeWhere(filters, timezoneSafe);
  const historyWhere: Prisma.StudySessionWhereInput = {
    userId,
    endedAt: { not: null },
    ...(startedAt ? { startedAt } : {}),
  };
  const analyticsStart = new Date(Date.now() - 84 * DAY_MS);
  const xpStart = new Date(Date.now() - 30 * DAY_MS);

  const [
    analyticsSessions,
    events,
    xpBefore,
    scheduled,
    totalAggregate,
    totalQuizzes,
    profile,
    historyRows,
    historyTotal,
    scoredRows,
    selectedRow,
  ] = await Promise.all([
    prisma.studySession.findMany({
      where: {
        userId,
        endedAt: { not: null },
        startedAt: { gte: analyticsStart },
      },
      select: { startedAt: true, actualDurationSec: true },
    }),
    prisma.activityEvent.findMany({
      where: { userId, xpDelta: { gt: 0 }, createdAt: { gte: xpStart } },
      select: { createdAt: true, xpDelta: true },
    }),
    prisma.activityEvent.aggregate({
      where: { userId, xpDelta: { gt: 0 }, createdAt: { lt: xpStart } },
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
    prisma.studySession.findMany({
      where: historyWhere,
      orderBy: { startedAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: SESSION_SELECT,
    }),
    prisma.studySession.count({ where: historyWhere }),
    prisma.studySession.findMany({
      where: { ...historyWhere, scoreStatus: "SCORED" },
      orderBy: { startedAt: "asc" },
      select: { id: true, qualityScore: true, startedAt: true },
    }),
    filters.sessionId
      ? prisma.studySession.findFirst({
          where: {
            id: filters.sessionId,
            userId,
            endedAt: { not: null },
          },
          select: SESSION_SELECT,
        })
      : Promise.resolve(null),
  ]);

  const studyByDate = new Map<string, number>();
  for (const session of analyticsSessions) {
    const date = localDateString(session.startedAt, timezoneSafe);
    studyByDate.set(
      date,
      (studyByDate.get(date) ?? 0) + (session.actualDurationSec ?? 0),
    );
  }
  const dailyStudy = lastNDates(14, timezoneSafe).map((date) => ({
    date,
    label: shortLabel(date),
    minutes: Math.round((studyByDate.get(date) ?? 0) / 60),
  }));
  const activityCalendar = lastNDates(84, timezoneSafe).map((date) => ({
    date,
    minutes: Math.round((studyByDate.get(date) ?? 0) / 60),
  }));

  const xpByDate = new Map<string, number>();
  for (const event of events) {
    const date = localDateString(event.createdAt, timezoneSafe);
    xpByDate.set(date, (xpByDate.get(date) ?? 0) + event.xpDelta);
  }
  let runningXp = xpBefore._sum.xpDelta ?? 0;
  const xpCumulative = lastNDates(30, timezoneSafe).map((date) => {
    runningXp += xpByDate.get(date) ?? 0;
    return { date, label: shortLabel(date), xp: runningXp };
  });

  const byWeek = new Map<string, { planned: number; completed: number }>();
  for (const session of scheduled) {
    const week = mondayKey(session.plannedLocalDate);
    const entry = byWeek.get(week) ?? { planned: 0, completed: 0 };
    entry.planned += session.targetDurationSec;
    if (session.status === "COMPLETED") {
      entry.completed += session.targetDurationSec;
    }
    byWeek.set(week, entry);
  }
  const currentMonday = mondayKey(localDateString(new Date(), timezoneSafe));
  const weeklyAdherence = Array.from({ length: 6 }, (_, index) => {
    const week = shiftDate(currentMonday, (index - 5) * 7);
    const entry = byWeek.get(week) ?? { planned: 0, completed: 0 };
    return {
      week: shortLabel(week),
      pct:
        entry.planned > 0
          ? Math.round((entry.completed / entry.planned) * 100)
          : 0,
    };
  });

  const scores = scoredRows.flatMap((row) =>
    row.qualityScore == null ? [] : [row.qualityScore],
  );
  const midpoint = Math.floor(scores.length / 2);
  const averageOf = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const olderAverage = averageOf(scores.slice(0, midpoint));
  const recentAverage = averageOf(scores.slice(midpoint));
  const average = averageOf(scores);

  return {
    totals: {
      studySeconds: totalAggregate._sum.actualDurationSec ?? 0,
      sessions: totalAggregate._count,
      quizzes: totalQuizzes,
      currentStreak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
    },
    dailyStudy,
    xpCumulative,
    weeklyAdherence,
    activityCalendar,
    quality: {
      average: average == null ? null : Math.round(average),
      scoredSessions: scores.length,
      unscoredSessions: Math.max(0, historyTotal - scores.length),
      trend:
        olderAverage == null || recentAverage == null
          ? null
          : Math.round(recentAverage - olderAverage),
      recentScores: scoredRows
        .slice(-12)
        .reverse()
        .flatMap((row) =>
          row.qualityScore == null
            ? []
            : [
                {
                  id: row.id,
                  score: row.qualityScore,
                  startedAtISO: row.startedAt.toISOString(),
                },
              ],
        ),
    },
    history: {
      entries: historyRows.map(toHistory),
      page: filters.page,
      pageSize: PAGE_SIZE,
      total: historyTotal,
      totalPages: Math.max(1, Math.ceil(historyTotal / PAGE_SIZE)),
    },
    selectedSession: selectedRow ? toHistory(selectedRow) : null,
    filters,
  };
}

export async function getProgressExportSessions(
  userId: string,
  filters: ProgressFilters,
  timezone: string,
): Promise<SessionHistoryEntry[]> {
  const startedAt = sessionRangeWhere(normalizeFilters(filters), timezone);
  const rows = await prisma.studySession.findMany({
    where: {
      userId,
      endedAt: { not: null },
      ...(startedAt ? { startedAt } : {}),
    },
    orderBy: { startedAt: "desc" },
    select: SESSION_SELECT,
  });
  return rows.map(toHistory);
}
