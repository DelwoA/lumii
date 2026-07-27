import "server-only";

import {
  Prisma,
  type SessionActivityType,
  type SessionScoreStatus,
  type StudySession,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/gamification/award";
import { sessionXp } from "@/lib/gamification/xp";
import { ADHERENCE_THRESHOLD } from "@/lib/gamification/streak";
import {
  getCurrentRank,
  processAdherenceForDay,
  runAwardChecks,
} from "@/lib/gamification/service";
import {
  NO_CELEBRATION,
  type Celebration,
} from "@/lib/gamification/celebration";
import {
  MIN_SCORED_DURATION_SEC,
  SESSION_QUALITY_VERSION,
  computeSessionQuality,
  type SessionQualityBreakdown,
} from "@/lib/gamification/session-quality";
import {
  HARD_CAP_SEC,
  autoCloseDecision,
  creditedDurationSec,
} from "@/lib/sessions/timing";
import type {
  ActiveSession,
  SessionStartInput,
  StopResult,
} from "@/lib/sessions/types";

type SessionWithSchedule = StudySession & {
  scheduledSession?: { title: string; goal: string | null } | null;
};

function toActive(session: SessionWithSchedule): ActiveSession {
  return {
    id: session.id,
    startedAtMs: session.startedAt.getTime(),
    targetDurationSec: session.targetDurationSec,
    title: session.title || session.scheduledSession?.title || "Study session",
    goal: session.goal ?? session.scheduledSession?.goal ?? null,
    scheduledSessionId: session.scheduledSessionId,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function scoreStatus(
  creditedDuration: number,
  targetDuration: number,
): SessionScoreStatus {
  if (targetDuration <= 0) return "NO_TARGET";
  if (creditedDuration < MIN_SCORED_DURATION_SEC) return "TOO_SHORT";
  return "SCORED";
}

async function readCanonicalResult(session: StudySession): Promise<{
  qualityScore: number | null;
  scoreStatus: SessionScoreStatus;
  qualityBreakdown: SessionQualityBreakdown | null;
  xpAwarded: number;
}> {
  const row = await prisma.studySession.findUnique({
    where: { id: session.id },
    select: {
      qualityScore: true,
      scoreStatus: true,
      qualityBreakdown: true,
      autoClosed: true,
      qualityVersion: true,
    },
  });
  let xpAwarded = 0;
  if (row?.qualityScore != null) {
    await awardXp({
      userId: session.userId,
      type: "SESSION_COMPLETED",
      requestedXp: sessionXp(row.qualityScore),
      idempotencyKey: `session-completed:${session.id}`,
      sourceType: "study_session",
      sourceId: session.id,
      payload: {
        qualityScore: row.qualityScore,
        qualityVersion: row.qualityVersion,
        autoClosed: row.autoClosed,
      },
    });
    const event = await prisma.activityEvent.findUnique({
      where: { idempotencyKey: `session-completed:${session.id}` },
      select: { xpDelta: true },
    });
    xpAwarded = event?.xpDelta ?? 0;
  }
  return {
    qualityScore: row?.qualityScore ?? null,
    scoreStatus: row?.scoreStatus ?? "PENDING",
    qualityBreakdown:
      (row?.qualityBreakdown as SessionQualityBreakdown | null) ?? null,
    xpAwarded,
  };
}

/**
 * Close and score a session as one transaction. The close-if-open write makes
 * retries and stop/heartbeat races idempotent; the persisted breakdown is the
 * canonical explanation shown in completion and history views.
 */
async function finalize(args: {
  session: StudySession;
  endMs: number;
  explicitStop: boolean;
  autoClosed: boolean;
  autoCloseReason?: "idle" | "cap" | null;
  goalCompleted?: boolean;
  reflection?: string;
}): Promise<{
  qualityScore: number | null;
  scoreStatus: SessionScoreStatus;
  qualityBreakdown: SessionQualityBreakdown | null;
  celebration: Celebration;
  xpAwarded: number;
}> {
  const { session, endMs, explicitStop, autoClosed } = args;
  const rankBefore = await getCurrentRank(session.userId);
  const credited = creditedDurationSec(session.startedAt.getTime(), endMs);
  const target = session.targetDurationSec ?? 0;
  const status = scoreStatus(credited, target);

  const transactionResult = await prisma.$transaction(async (tx) => {
    const closed = await tx.studySession.updateMany({
      where: { id: session.id, userId: session.userId, endedAt: null },
      data: {
        endedAt: new Date(endMs),
        actualDurationSec: credited,
        goalCompleted: args.goalCompleted ?? session.goalCompleted ?? null,
        reflection: args.reflection ?? session.reflection ?? null,
        autoClosed,
        autoCloseReason: args.autoCloseReason ?? null,
      },
    });
    if (closed.count === 0) return null;

    const grouped = await tx.sessionActivity.groupBy({
      by: ["type"],
      where: { sessionId: session.id },
      _count: { _all: true },
    });
    const activityCount = new Map(
      grouped.map((entry) => [entry.type, entry._count._all]),
    );
    const quality =
      status === "SCORED"
        ? computeSessionQuality({
            creditedDurationSec: credited,
            targetDurationSec: target,
            explicitStop,
            goalCompleted: args.goalCompleted ?? false,
            autoClosed,
            activity: {
              summariesGenerated: activityCount.get("SUMMARY_GENERATED") ?? 0,
              tutorQuestions: activityCount.get("TUTOR_QUESTION") ?? 0,
              quizzesCompleted: activityCount.get("QUIZ_COMPLETED") ?? 0,
            },
          })
        : null;

    await tx.studySession.update({
      where: { id: session.id },
      data: {
        scoreStatus: status,
        qualityScore: quality?.total ?? null,
        qualityVersion: quality ? SESSION_QUALITY_VERSION : null,
        qualityBreakdown: quality
          ? (quality as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });

    let planDate: string | null = null;
    if (session.scheduledSessionId) {
      const [plan, totals] = await Promise.all([
        tx.scheduledSession.findFirst({
          where: { id: session.scheduledSessionId, userId: session.userId },
          select: { plannedLocalDate: true, targetDurationSec: true },
        }),
        tx.studySession.aggregate({
          where: {
            scheduledSessionId: session.scheduledSessionId,
            endedAt: { not: null },
          },
          _sum: { actualDurationSec: true },
        }),
      ]);
      if (plan) {
        planDate = plan.plannedLocalDate;
        if (
          (totals._sum.actualDurationSec ?? 0) >=
          ADHERENCE_THRESHOLD * plan.targetDurationSec
        ) {
          await tx.scheduledSession.updateMany({
            where: {
              id: session.scheduledSessionId,
              userId: session.userId,
              status: { in: ["PLANNED", "MISSED"] },
            },
            data: { status: "COMPLETED" },
          });
        }
      }
    }

    return { quality, planDate };
  });

  if (!transactionResult) {
    const canonical = await readCanonicalResult(session);
    return {
      ...canonical,
      celebration: NO_CELEBRATION,
    };
  }

  let xpAwarded = 0;
  if (transactionResult.quality) {
    const award = await awardXp({
      userId: session.userId,
      type: "SESSION_COMPLETED",
      requestedXp: sessionXp(transactionResult.quality.total),
      idempotencyKey: `session-completed:${session.id}`,
      sourceType: "study_session",
      sourceId: session.id,
      payload: {
        qualityScore: transactionResult.quality.total,
        qualityVersion: SESSION_QUALITY_VERSION,
        autoClosed,
      },
    });
    xpAwarded = award.xpAwarded;
  }

  let celebration = NO_CELEBRATION;
  try {
    if (transactionResult.planDate) {
      await processAdherenceForDay(session.userId, transactionResult.planDate);
    }
    celebration = await runAwardChecks(session.userId, rankBefore);
  } catch {
    // Scoring is already durable; rewards are intentionally best-effort.
  }

  return {
    qualityScore: transactionResult.quality?.total ?? null,
    scoreStatus: status,
    qualityBreakdown: transactionResult.quality,
    celebration,
    xpAwarded,
  };
}

async function reconcile(open: StudySession): Promise<boolean> {
  const decision = autoCloseDecision(
    {
      startedAtMs: open.startedAt.getTime(),
      lastHeartbeatMs: open.lastHeartbeatAt?.getTime() ?? null,
    },
    Date.now(),
  );
  if (!decision.shouldClose) return false;
  await finalize({
    session: open,
    endMs: decision.endMs,
    explicitStop: false,
    autoClosed: true,
    autoCloseReason: decision.reason,
  });
  return true;
}

export async function getActiveSession(
  userId: string,
): Promise<ActiveSession | null> {
  const open = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    include: { scheduledSession: { select: { title: true, goal: true } } },
  });
  if (!open) return null;
  if (await reconcile(open)) return null;
  return toActive(open);
}

async function assertSessionTaxonomy(
  userId: string,
  subjectId: string | null,
  topicId: string | null,
) {
  if (!subjectId && topicId) throw new Error("Choose a subject first");
  if (!subjectId) return;
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId, archivedAt: null },
    select: {
      id: true,
      topics: {
        where: { id: topicId ?? undefined, archivedAt: null },
        select: { id: true },
      },
    },
  });
  if (!subject || (topicId && subject.topics.length === 0)) {
    throw new Error("Subject or topic not found");
  }
}

export async function startSession(
  userId: string,
  input: SessionStartInput = {},
): Promise<ActiveSession> {
  const existingOpen = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    include: { scheduledSession: { select: { title: true, goal: true } } },
  });
  if (existingOpen && !(await reconcile(existingOpen))) {
    return toActive(existingOpen);
  }

  let data: {
    scheduledSessionId: string | null;
    targetDurationSec: number;
    title: string;
    goal: string | null;
    subjectId: string | null;
    topicId: string | null;
  };

  if (input.scheduledSessionId) {
    const scheduled = await prisma.scheduledSession.findFirst({
      where: {
        id: input.scheduledSessionId,
        userId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: {
        id: true,
        title: true,
        goal: true,
        subjectId: true,
        topicId: true,
        targetDurationSec: true,
        studySessions: {
          where: { endedAt: { not: null } },
          select: { actualDurationSec: true },
        },
      },
    });
    if (!scheduled)
      throw new Error("This planned session is no longer available");
    const completed = scheduled.studySessions.reduce(
      (sum, attempt) => sum + (attempt.actualDurationSec ?? 0),
      0,
    );
    data = {
      scheduledSessionId: scheduled.id,
      targetDurationSec: Math.max(60, scheduled.targetDurationSec - completed),
      title: scheduled.title,
      goal: scheduled.goal,
      subjectId: scheduled.subjectId,
      topicId: scheduled.topicId,
    };
  } else {
    const target = Math.floor(input.targetDurationSec ?? 25 * 60);
    if (target < 10 * 60 || target > 4 * 60 * 60) {
      throw new Error("Target must be between 10 minutes and 4 hours");
    }
    const title = input.title?.trim() || "Focused study";
    if (title.length > 120) throw new Error("Title is too long");
    await assertSessionTaxonomy(
      userId,
      input.subjectId ?? null,
      input.topicId ?? null,
    );
    data = {
      scheduledSessionId: null,
      targetDurationSec: target,
      title,
      goal: input.goal?.trim() || null,
      subjectId: input.subjectId ?? null,
      topicId: input.topicId ?? null,
    };
  }

  try {
    const created = await prisma.studySession.create({
      data: {
        userId,
        ...data,
        lastHeartbeatAt: new Date(),
      },
      include: { scheduledSession: { select: { title: true, goal: true } } },
    });
    await prisma.activityEvent.create({
      data: {
        userId,
        type: "SESSION_STARTED",
        sourceType: "study_session",
        sourceId: created.id,
        idempotencyKey: `session-started:${created.id}`,
        xpDelta: 0,
      },
    });
    return toActive(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const open = await prisma.studySession.findFirst({
        where: { userId, endedAt: null },
        include: { scheduledSession: { select: { title: true, goal: true } } },
      });
      if (open) return toActive(open);
    }
    throw error;
  }
}

export async function recordHeartbeat(
  userId: string,
  sessionId: string,
): Promise<{ open: boolean }> {
  const open = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, endedAt: null },
  });
  if (!open || (await reconcile(open))) return { open: false };
  await prisma.studySession.updateMany({
    where: { id: sessionId, userId, endedAt: null },
    data: { lastHeartbeatAt: new Date() },
  });
  return { open: true };
}

export async function stopSession(
  userId: string,
  sessionId: string,
  opts: { goalCompleted?: boolean; reflection?: string },
): Promise<StopResult> {
  const open = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, endedAt: null },
  });
  if (!open) return { ok: false, error: "No active session to stop" };
  const endMs = Math.min(
    Date.now(),
    open.startedAt.getTime() + HARD_CAP_SEC * 1000,
  );
  const result = await finalize({
    session: open,
    endMs,
    explicitStop: true,
    autoClosed: false,
    goalCompleted: opts.goalCompleted,
    reflection: opts.reflection,
  });
  return {
    ok: true,
    sessionId: open.id,
    durationSec: creditedDurationSec(open.startedAt.getTime(), endMs),
    qualityScore: result.qualityScore,
    scoreStatus: result.scoreStatus,
    qualityBreakdown: result.qualityBreakdown,
    qualityVersion:
      result.scoreStatus === "SCORED" ? SESSION_QUALITY_VERSION : null,
    celebration: result.celebration,
    xpAwarded: result.xpAwarded,
  };
}

/**
 * Record metadata-only, server-verified learning activity against the open
 * session. The unique key makes retries/double-clicks harmless.
 */
export async function recordSessionActivity(
  userId: string,
  type: SessionActivityType,
  sourceId: string,
): Promise<void> {
  if (!sourceId) return;
  const session = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    select: { id: true },
  });
  if (!session) return;
  try {
    await prisma.sessionActivity.create({
      data: { userId, sessionId: session.id, type, sourceId },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      // Activity credit must never break the primary learning action.
    }
  }
}
