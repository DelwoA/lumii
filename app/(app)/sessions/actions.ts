"use server";

// =============================================================================
// FILE: app/(app)/sessions/actions.ts
// WHAT THIS FILE DOES:
//   The thin server actions the browser calls to control a study session:
//   get the current one, start, send a heartbeat, and stop. They check the
//   signed-in user and then hand off to the real logic in lib/sessions/service.
//   The browser side that calls these lives in lib/stores/session-store.ts.
// =============================================================================

import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getActiveSession,
  recordHeartbeat,
  startSession,
  stopSession,
} from "@/lib/sessions/service";
import type {
  ActiveSession,
  HeartbeatResult,
  StartResult,
  StopResult,
  SessionStartInput,
  SessionSetupOption,
} from "@/lib/sessions/types";

const startSchema = z.object({
  scheduledSessionId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  goal: z.string().trim().max(500).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  topicId: z.string().min(1).nullable().optional(),
  targetDurationSec: z
    .number()
    .int()
    .min(10 * 60)
    .max(4 * 60 * 60)
    .optional(),
});

export async function getActiveSessionAction(): Promise<ActiveSession | null> {
  const user = await requireDbUser();
  return getActiveSession(user.id);
}

export async function startSessionAction(
  input: SessionStartInput = {},
): Promise<StartResult> {
  const user = await requireDbUser();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid session setup",
    };
  }
  try {
    const active = await startSession(user.id, parsed.data);
    return { ok: true, active };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not start the session",
    };
  }
}

export async function getSessionSetupOptionsAction(): Promise<
  SessionSetupOption[]
> {
  const user = await requireDbUser();
  return prisma.subject.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      topics: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}

export async function stopSessionAction(
  sessionId: string,
  opts: { goalCompleted?: boolean; reflection?: string },
): Promise<StopResult> {
  const user = await requireDbUser();
  return stopSession(user.id, sessionId, opts);
}

export async function heartbeatAction(
  sessionId: string,
): Promise<HeartbeatResult> {
  const user = await requireDbUser();
  return recordHeartbeat(user.id, sessionId);
}
