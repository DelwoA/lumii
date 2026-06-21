"use server";

import { requireDbUser } from "@/lib/auth";
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
} from "@/lib/sessions/types";

export async function getActiveSessionAction(): Promise<ActiveSession | null> {
  const user = await requireDbUser();
  return getActiveSession(user.id);
}

export async function startSessionAction(
  scheduledSessionId?: string,
): Promise<StartResult> {
  const user = await requireDbUser();
  try {
    const active = await startSession(user.id, scheduledSessionId);
    return { ok: true, active };
  } catch {
    return { ok: false, error: "Could not start the session" };
  }
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
