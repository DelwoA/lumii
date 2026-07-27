import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidTimeZone, localDateString } from "./dates";
import { deriveTimetableStatus } from "./status";
import type { TimetableSession } from "./types";

export interface ScheduledInput {
  title: string;
  subjectId: string | null;
  topicId: string | null;
  goal: string | null;
  startISO: string;
  endISO: string;
  timeZone: string;
  allowOverlap?: boolean;
}

export class ScheduleOverlapError extends Error {
  constructor(public readonly conflictingTitle: string) {
    super(`This overlaps with “${conflictingTitle}”`);
    this.name = "ScheduleOverlapError";
  }
}

const ROW_INCLUDE = {
  subject: { select: { name: true, color: true } },
  topic: { select: { name: true } },
  studySessions: {
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      endedAt: true,
      actualDurationSec: true,
      qualityScore: true,
    },
  },
} as const;

type Row = Prisma.ScheduledSessionGetPayload<{
  include: typeof ROW_INCLUDE;
}>;

function toTimetable(row: Row): TimetableSession {
  const endedAttempts = row.studySessions.filter((attempt) => attempt.endedAt);
  const actualDurationSec = endedAttempts.reduce(
    (sum, attempt) => sum + (attempt.actualDurationSec ?? 0),
    0,
  );
  const active = row.studySessions.some((attempt) => !attempt.endedAt);
  const status = deriveTimetableStatus({
    storedStatus: row.status,
    plannedEndMs: row.plannedEnd.getTime(),
    nowMs: Date.now(),
    targetDurationSec: row.targetDurationSec,
    actualDurationSec,
    hasActiveAttempt: active,
  });

  return {
    id: row.id,
    title: row.title,
    subjectId: row.subjectId,
    subjectName: row.subject?.name ?? null,
    subjectColor: row.subject?.color ?? null,
    topicId: row.topicId,
    topicName: row.topic?.name ?? null,
    goal: row.goal,
    plannedStartISO: row.plannedStart.toISOString(),
    plannedEndISO: row.plannedEnd.toISOString(),
    plannedLocalDate: row.plannedLocalDate,
    planningTimezone: row.planningTimezone,
    targetDurationSec: row.targetDurationSec,
    actualDurationSec,
    remainingDurationSec: Math.max(
      0,
      row.targetDurationSec - actualDurationSec,
    ),
    completionPercent: Math.min(
      100,
      Math.round((actualDurationSec / row.targetDurationSec) * 100),
    ),
    attemptCount: endedAttempts.length,
    latestQualityScore:
      endedAttempts.find((attempt) => attempt.qualityScore != null)
        ?.qualityScore ?? null,
    status,
    canEdit: row.studySessions.length === 0,
    canCancel:
      status !== "ACTIVE" && status !== "COMPLETED" && status !== "CANCELLED",
  };
}

export async function reconcileScheduled(userId: string): Promise<void> {
  await prisma.scheduledSession.updateMany({
    where: { userId, status: "PLANNED", plannedEnd: { lt: new Date() } },
    data: { status: "MISSED" },
  });
}

export async function listScheduled(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<TimetableSession[]> {
  await reconcileScheduled(userId);
  const rows = await prisma.scheduledSession.findMany({
    where: {
      userId,
      status: { not: "CANCELLED" },
      plannedStart: { gte: new Date(fromISO), lte: new Date(toISO) },
    },
    orderBy: { plannedStart: "asc" },
    include: ROW_INCLUDE,
  });
  return rows.map(toTimetable);
}

export async function listForLocalDate(
  userId: string,
  localDate: string,
): Promise<TimetableSession[]> {
  await reconcileScheduled(userId);
  const rows = await prisma.scheduledSession.findMany({
    where: {
      userId,
      plannedLocalDate: localDate,
      status: { not: "CANCELLED" },
    },
    orderBy: { plannedStart: "asc" },
    include: ROW_INCLUDE,
  });
  return rows.map(toTimetable);
}

async function assertSubjectTopic(
  userId: string,
  subjectId: string | null,
  topicId: string | null,
): Promise<void> {
  if (!subjectId && topicId) throw new Error("Choose a subject first");
  if (subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId, archivedAt: null },
      select: { id: true },
    });
    if (!subject) throw new Error("Subject not found");
  }
  if (topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, userId, archivedAt: null },
      select: { subjectId: true },
    });
    if (!topic || topic.subjectId !== subjectId) {
      throw new Error("Topic does not belong to the chosen subject");
    }
  }
}

async function maybeAdoptTimeZone(userId: string, timeZone: string) {
  if (!isValidTimeZone(timeZone) || timeZone === "UTC") return;
  await prisma.user.updateMany({
    where: { id: userId, timezone: "UTC" },
    data: { timezone: timeZone },
  });
}

function parseWindow(input: ScheduledInput) {
  const plannedStart = new Date(input.startISO);
  const plannedEnd = new Date(input.endISO);
  if (
    Number.isNaN(plannedStart.getTime()) ||
    Number.isNaN(plannedEnd.getTime())
  ) {
    throw new Error("Invalid date");
  }
  const targetDurationSec = Math.round(
    (plannedEnd.getTime() - plannedStart.getTime()) / 1000,
  );
  if (targetDurationSec < 10 * 60 || targetDurationSec > 4 * 60 * 60) {
    throw new Error("A plan must be between 10 minutes and 4 hours");
  }
  return { plannedStart, plannedEnd, targetDurationSec };
}

async function assertNoOverlap(
  userId: string,
  plannedStart: Date,
  plannedEnd: Date,
  allowOverlap: boolean,
  excludeId?: string,
) {
  if (allowOverlap) return;
  const conflict = await prisma.scheduledSession.findFirst({
    where: {
      userId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { not: "CANCELLED" },
      plannedStart: { lt: plannedEnd },
      plannedEnd: { gt: plannedStart },
    },
    orderBy: { plannedStart: "asc" },
    select: { title: true },
  });
  if (conflict) throw new ScheduleOverlapError(conflict.title);
}

export async function createScheduled(
  userId: string,
  input: ScheduledInput,
): Promise<void> {
  await assertSubjectTopic(userId, input.subjectId, input.topicId);
  const window = parseWindow(input);
  await assertNoOverlap(
    userId,
    window.plannedStart,
    window.plannedEnd,
    Boolean(input.allowOverlap),
  );
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  await maybeAdoptTimeZone(userId, timeZone);
  await prisma.scheduledSession.create({
    data: {
      userId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      title: input.title,
      goal: input.goal,
      ...window,
      plannedLocalDate: localDateString(window.plannedStart, timeZone),
      planningTimezone: timeZone,
    },
  });
}

export async function updateScheduled(
  userId: string,
  id: string,
  input: ScheduledInput,
): Promise<void> {
  const existing = await prisma.scheduledSession.findFirst({
    where: { id, userId },
    select: { status: true, _count: { select: { studySessions: true } } },
  });
  if (!existing) throw new Error("Session not found");
  if (existing._count.studySessions > 0) {
    throw new Error("A plan cannot be edited after an attempt has started");
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new Error("This plan can no longer be edited");
  }
  await assertSubjectTopic(userId, input.subjectId, input.topicId);
  const window = parseWindow(input);
  await assertNoOverlap(
    userId,
    window.plannedStart,
    window.plannedEnd,
    Boolean(input.allowOverlap),
    id,
  );
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  await maybeAdoptTimeZone(userId, timeZone);
  await prisma.scheduledSession.update({
    where: { id },
    data: {
      subjectId: input.subjectId,
      topicId: input.topicId,
      title: input.title,
      goal: input.goal,
      ...window,
      plannedLocalDate: localDateString(window.plannedStart, timeZone),
      planningTimezone: timeZone,
      status: window.plannedEnd > new Date() ? "PLANNED" : "MISSED",
    },
  });
}

export async function cancelScheduled(
  userId: string,
  id: string,
): Promise<void> {
  const existing = await prisma.scheduledSession.findFirst({
    where: { id, userId },
    select: {
      status: true,
      studySessions: {
        select: { endedAt: true, actualDurationSec: true },
      },
    },
  });
  if (!existing) throw new Error("Session not found");
  if (existing.status === "COMPLETED") {
    throw new Error("A completed plan cannot be cancelled");
  }
  if (existing.studySessions.some((attempt) => !attempt.endedAt)) {
    throw new Error("End the active attempt before cancelling this plan");
  }
  await prisma.scheduledSession.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}
