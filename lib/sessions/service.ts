import "server-only";
import { Prisma, type StudySession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/gamification/award";
import { sessionXp } from "@/lib/gamification/xp";
import { ADHERENCE_THRESHOLD } from "@/lib/gamification/streak";
import {
  getCurrentRank,
  processAdherenceForDay,
  runAwardChecks,
} from "@/lib/gamification/service";
import { NO_CELEBRATION, type Celebration } from "@/lib/gamification/celebration";
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
import type { ActiveSession, StopResult } from "@/lib/sessions/types";

export type EngagementField =
  | "summariesViewed"
  | "tutorQuestions"
  | "quizAttempts"
  | "explanationsReviewed";

type SessionWithSchedule = StudySession & {
  scheduledSession?: { title: string; goal: string | null } | null;
};

function toActive(s: SessionWithSchedule): ActiveSession {
  return {
    id: s.id,
    startedAtMs: s.startedAt.getTime(),
    targetDurationSec: s.targetDurationSec,
    title: s.scheduledSession?.title ?? "Study session",
    goal: s.scheduledSession?.goal ?? null,
    scheduledSessionId: s.scheduledSessionId,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

/**
 * Finalize an open session. Closes the row only if it is still open (so a
 * racing stop/reconcile cannot double-finalize), scores it when it ran long
 * enough, marks a linked scheduled session complete when sufficiently
 * adherent, and awards completion XP idempotently. Returns the quality
 * breakdown when scored (else null) plus any awards to celebrate.
 */
async function finalize(args: {
  session: StudySession;
  endMs: number;
  explicitStop: boolean;
  autoClosed: boolean;
  autoCloseReason?: "idle" | "cap" | null;
  goalCompleted?: boolean;
  reflection?: string;
}): Promise<{ quality: SessionQualityBreakdown | null; celebration: Celebration }> {
  const { session, endMs, explicitStop, autoClosed } = args;
  const rankBefore = await getCurrentRank(session.userId);
  const credited = creditedDurationSec(session.startedAt.getTime(), endMs);
  const target = session.targetDurationSec ?? 0;
  const scored = credited >= MIN_SCORED_DURATION_SEC && target > 0;

  const quality = scored
    ? computeSessionQuality({
        creditedDurationSec: credited,
        targetDurationSec: target,
        explicitStop,
        goalCompleted: args.goalCompleted ?? false,
        autoClosed,
        summariesViewed: session.summariesViewed,
        tutorQuestions: session.tutorQuestions,
        quizAttempts: session.quizAttempts,
        explanationsReviewed: session.explanationsReviewed,
      })
    : null;

  // Atomic close-if-open: count === 0 means another path already closed it.
  const closed = await prisma.studySession.updateMany({
    where: { id: session.id, endedAt: null },
    data: {
      endedAt: new Date(endMs),
      actualDurationSec: credited,
      goalCompleted: args.goalCompleted ?? session.goalCompleted ?? null,
      reflection: args.reflection ?? session.reflection ?? null,
      qualityScore: quality?.total ?? null,
      qualityVersion: quality ? SESSION_QUALITY_VERSION : null,
      autoClosed,
      autoCloseReason: args.autoCloseReason ?? null,
    },
  });
  if (closed.count === 0) return { quality: null, celebration: NO_CELEBRATION };

  // A study session that met the per-session adherence bar completes its plan.
  if (
    session.scheduledSessionId &&
    target > 0 &&
    credited >= ADHERENCE_THRESHOLD * target
  ) {
    await prisma.scheduledSession.updateMany({
      where: {
        id: session.scheduledSessionId,
        userId: session.userId,
        status: { in: ["PLANNED", "MISSED"] },
      },
      data: { status: "COMPLETED" },
    });
  }

  if (quality) {
    await awardXp({
      userId: session.userId,
      type: "SESSION_COMPLETED",
      requestedXp: sessionXp(quality.total),
      idempotencyKey: `session-completed:${session.id}`,
      sourceType: "study_session",
      sourceId: session.id,
      payload: { qualityScore: quality.total, autoClosed },
    });
  }

  // Best-effort gamification follow-ups (adherent/perfect-day XP, streak,
  // trophies, rank-up). A failure here must never undo a finalized session.
  let celebration = NO_CELEBRATION;
  try {
    if (session.scheduledSessionId) {
      const sched = await prisma.scheduledSession.findUnique({
        where: { id: session.scheduledSessionId },
        select: { plannedLocalDate: true },
      });
      if (sched) await processAdherenceForDay(session.userId, sched.plannedLocalDate);
    }
    celebration = await runAwardChecks(session.userId, rankBefore);
  } catch {
    // ignore
  }

  return { quality, celebration };
}

/** Auto-close an open session if it is idle or past the hard cap. */
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

/** The user's current active session (reconciling/auto-closing stale ones). */
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

/**
 * Start a session (optionally bound to a scheduled session). Reconciles first;
 * if a non-stale session is already open, returns it (resume) rather than
 * creating a duplicate. The partial unique index is the last-resort guard
 * against a concurrent double-start.
 */
export async function startSession(
  userId: string,
  scheduledSessionId?: string,
): Promise<ActiveSession> {
  const existingOpen = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    include: { scheduledSession: { select: { title: true, goal: true } } },
  });
  if (existingOpen) {
    if (!(await reconcile(existingOpen))) return toActive(existingOpen);
  }

  let targetDurationSec: number | null = null;
  if (scheduledSessionId) {
    const sched = await prisma.scheduledSession.findFirst({
      where: { id: scheduledSessionId, userId },
      select: { targetDurationSec: true },
    });
    if (!sched) throw new Error("Scheduled session not found");
    targetDurationSec = sched.targetDurationSec;

    // One study session per scheduled session (scheduledSessionId is @unique).
    const linked = await prisma.studySession.findUnique({
      where: { scheduledSessionId },
      include: { scheduledSession: { select: { title: true, goal: true } } },
    });
    if (linked && !linked.endedAt) return toActive(linked);
    if (linked && linked.endedAt) {
      // Already completed once: run a fresh standalone session instead.
      scheduledSessionId = undefined;
      targetDurationSec = null;
    }
  }

  try {
    const created = await prisma.studySession.create({
      data: {
        userId,
        scheduledSessionId: scheduledSessionId ?? null,
        targetDurationSec,
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
  } catch (e) {
    if (isUniqueViolation(e)) {
      const open = await prisma.studySession.findFirst({
        where: { userId, endedAt: null },
        include: { scheduledSession: { select: { title: true, goal: true } } },
      });
      if (open) return toActive(open);
    }
    throw e;
  }
}

/** Record a heartbeat; auto-closes (and reports closed) if already stale. */
export async function recordHeartbeat(
  userId: string,
  sessionId: string,
): Promise<{ open: boolean }> {
  const open = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, endedAt: null },
  });
  if (!open) return { open: false };
  if (await reconcile(open)) return { open: false };

  await prisma.studySession.updateMany({
    where: { id: sessionId, userId, endedAt: null },
    data: { lastHeartbeatAt: new Date() },
  });
  return { open: true };
}

/** Explicitly stop a session, crediting up to now (capped). */
export async function stopSession(
  userId: string,
  sessionId: string,
  opts: { goalCompleted?: boolean; reflection?: string },
): Promise<StopResult> {
  const open = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, endedAt: null },
  });
  if (!open) return { ok: false, error: "No active session to stop" };

  const capEndMs = open.startedAt.getTime() + HARD_CAP_SEC * 1000;
  const endMs = Math.min(Date.now(), capEndMs);
  const { quality, celebration } = await finalize({
    session: open,
    endMs,
    explicitStop: true,
    autoClosed: false,
    goalCompleted: opts.goalCompleted,
    reflection: opts.reflection,
  });

  return {
    ok: true,
    durationSec: creditedDurationSec(open.startedAt.getTime(), endMs),
    qualityScore: quality?.total ?? null,
    scored: quality !== null,
    celebration,
  };
}

/**
 * Best-effort increment of a server-confirmed engagement counter on the user's
 * open session (if any). Never throws into the calling AI action.
 */
export async function bumpEngagement(
  userId: string,
  field: EngagementField,
): Promise<void> {
  try {
    await prisma.studySession.updateMany({
      where: { userId, endedAt: null },
      data: { [field]: { increment: 1 } },
    });
  } catch {
    // Engagement counters are non-critical; swallow failures.
  }
}
