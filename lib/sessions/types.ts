/** Client-safe session types (no server-only imports). */
import type { Celebration } from "@/lib/gamification/celebration";

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
      durationSec: number;
      qualityScore: number | null;
      scored: boolean;
      celebration?: Celebration;
    }
  | { ok: false; error: string };

export interface HeartbeatResult {
  open: boolean;
}
