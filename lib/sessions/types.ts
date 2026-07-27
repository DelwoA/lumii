// =============================================================================
// FILE: lib/sessions/types.ts
// WHAT THIS FILE DOES:
//   Shared "shapes" (TypeScript types) describing a study session and the
//   results of starting/stopping one. These are kept in their own file with no
//   server-only code so BOTH the server logic and the browser components can
//   import them and stay in agreement about the data they pass around.
// =============================================================================
/** Client-safe session types (no server-only imports). */
import type { Celebration } from "@/lib/gamification/celebration";
import type { SessionQualityBreakdown } from "@/lib/gamification/session-quality";

export interface SessionStartInput {
  scheduledSessionId?: string;
  title?: string;
  goal?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  targetDurationSec?: number;
}

export interface SessionSetupOption {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

export interface ActiveSession {
  id: string;
  /** Epoch ms; the client derives the live elapsed timer from this. */
  startedAtMs: number;
  targetDurationSec: number | null;
  title: string;
  goal: string | null;
  scheduledSessionId: string | null;
}

export type StartResult =
  | { ok: true; active: ActiveSession }
  | { ok: false; error: string };

export type StopResult =
  | {
      ok: true;
      sessionId: string;
      durationSec: number;
      qualityScore: number | null;
      scoreStatus: "PENDING" | "SCORED" | "TOO_SHORT" | "NO_TARGET";
      qualityBreakdown: SessionQualityBreakdown | null;
      qualityVersion: string | null;
      celebration?: Celebration;
      xpAwarded?: number;
    }
  | { ok: false; error: string };

export interface HeartbeatResult {
  open: boolean;
}
