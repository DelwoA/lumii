// =============================================================================
// FILE: lib/timetable/service.ts
// WHAT THIS FILE DOES:
//   The back-end logic for the Timetable: creating, editing, listing, and
//   cancelling planned study sessions, all owner-scoped to the signed-in user.
//   It records each planned session with its local calendar date (using
//   ./dates) so streaks and adherence line up with the student's own day.
// =============================================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidTimeZone, localDateString } from "./dates";
import type { TimetableSession } from "./types";

export interface ScheduledInput {
  title: string;
  subjectId: string | null;
  topicId: string | null;
  goal: string | null;
  startISO: string;
  endISO: string;
  timeZone: string;
}

type Row = Prisma.ScheduledSessionGetPayload<{
  include: {
    subject: { select: { name: true; color: true } };
    topic: { select: { name: true } };
    studySession: { select: { id: true } };
  };
}>;

const ROW_INCLUDE = {
  subject: { select: { name: true, color: true } },
  topic: { select: { name: true } },
  studySession: { select: { id: true } },
} as const;

function toTimetable(s: Row): TimetableSession {
  return {
    id: s.id,
    title: s.title,
    subjectName: s.subject?.name ?? null,
    subjectColor: s.subject?.color ?? null,
    topicName: s.topic?.name ?? null,
    goal: s.goal,
    plannedStartISO: s.plannedStart.toISOString(),
    plannedEndISO: s.plannedEnd.toISOString(),
    plannedLocalDate: s.plannedLocalDate,
    targetDurationSec: s.targetDurationSec,
    status: s.status,
    hasStudySession: s.studySession !== null,
  };
}

/** Flip overdue PLANNED sessions to MISSED. A later linked study session that
 * meets the adherence bar flips them back to COMPLETED (see sessions service). */
export async function reconcileScheduled(userId: string): Promise<void> {
  await prisma.scheduledSession.updateMany({
    where: { userId, status: "PLANNED", plannedEnd: { lt: new Date() } },
    data: { status: "MISSED" },
  });
}

/** List non-cancelled scheduled sessions whose start falls in [fromISO, toISO]. */
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

/** Non-cancelled sessions planned for a specific local date (for the dashboard). */
export async function listForLocalDate(
  userId: string,
  localDate: string,
): Promise<TimetableSession[]> {
  await reconcileScheduled(userId);
  const rows = await prisma.scheduledSession.findMany({
    where: { userId, plannedLocalDate: localDate, status: { not: "CANCELLED" } },
    orderBy: { plannedStart: "asc" },
    include: ROW_INCLUDE,
  });
  return rows.map(toTimetable);
}

/** Verify any chosen subject/topic belong to the user (and topic to subject). */
async function assertSubjectTopic(
  userId: string,
  subjectId: string | null,
  topicId: string | null,
): Promise<void> {
  if (subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
      select: { id: true },
    });
    if (!subject) throw new Error("Subject not found");
  }
  if (topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, userId },
      select: { subjectId: true },
    });
    if (!topic) throw new Error("Topic not found");
    if (subjectId && topic.subjectId !== subjectId) {
      throw new Error("Topic does not belong to the chosen subject");
    }
  }
}

/** Lazily adopt the browser timezone if the user is still on the UTC default. */
async function maybeAdoptTimeZone(userId: string, timeZone: string): Promise<void> {
  if (!isValidTimeZone(timeZone) || timeZone === "UTC") return;
  await prisma.user.updateMany({
    where: { id: userId, timezone: "UTC" },
    data: { timezone: timeZone },
  });
}

function parseWindow(input: ScheduledInput): {
  plannedStart: Date;
  plannedEnd: Date;
  targetDurationSec: number;
} {
  const plannedStart = new Date(input.startISO);
  const plannedEnd = new Date(input.endISO);
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(plannedEnd.getTime())) {
    throw new Error("Invalid date");
  }
  const targetDurationSec = Math.round(
    (plannedEnd.getTime() - plannedStart.getTime()) / 1000,
  );
  if (targetDurationSec <= 0) throw new Error("End must be after start");
  return { plannedStart, plannedEnd, targetDurationSec };
}

export async function createScheduled(
  userId: string,
  input: ScheduledInput,
): Promise<void> {
  await assertSubjectTopic(userId, input.subjectId, input.topicId);
  const { plannedStart, plannedEnd, targetDurationSec } = parseWindow(input);
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  await maybeAdoptTimeZone(userId, timeZone);

  await prisma.scheduledSession.create({
    data: {
      userId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      title: input.title,
      goal: input.goal,
      plannedStart,
      plannedEnd,
      plannedLocalDate: localDateString(plannedStart, timeZone),
      planningTimezone: timeZone,
      targetDurationSec,
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
    select: { status: true },
  });
  if (!existing) throw new Error("Session not found");
  if (existing.status === "COMPLETED") {
    throw new Error("A completed session cannot be edited");
  }

  await assertSubjectTopic(userId, input.subjectId, input.topicId);
  const { plannedStart, plannedEnd, targetDurationSec } = parseWindow(input);
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  await maybeAdoptTimeZone(userId, timeZone);

  await prisma.scheduledSession.updateMany({
    where: { id, userId },
    data: {
      subjectId: input.subjectId,
      topicId: input.topicId,
      title: input.title,
      goal: input.goal,
      plannedStart,
      plannedEnd,
      plannedLocalDate: localDateString(plannedStart, timeZone),
      planningTimezone: timeZone,
      targetDurationSec,
      // Editing an overdue (MISSED) session back into the future re-arms it.
      status: plannedEnd > new Date() ? "PLANNED" : "MISSED",
    },
  });
}

export async function cancelScheduled(userId: string, id: string): Promise<void> {
  const existing = await prisma.scheduledSession.findFirst({
    where: { id, userId },
    select: { status: true },
  });
  if (!existing) throw new Error("Session not found");
  if (existing.status === "COMPLETED") {
    throw new Error("A completed session cannot be cancelled");
  }
  await prisma.scheduledSession.updateMany({
    where: { id, userId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}
