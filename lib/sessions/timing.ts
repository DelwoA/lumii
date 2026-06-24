// =============================================================================
// FILE: lib/sessions/timing.ts
// WHAT THIS FILE DOES:
//   The pure maths for study-session timing: how long a session counts for, and
//   when to auto-close one the student forgot to stop. It has no database and no
//   clock of its own (the current time is passed in), which makes it easy and
//   reliable to unit-test (see timing.test.ts).
//
// KEY IDEAS:
//   - Heartbeat: while the tab is open, the browser quietly pings the server
//     every 30 seconds so we know the student is still there.
//   - Auto-close ("reconcile on read"): instead of a background job, each time
//     the app checks an open session it works out whether it should have closed:
//       * Hard cap: a session can never count for more than 4 hours.
//       * Idle: if there has been no heartbeat for 5 minutes, the student likely
//         walked away, so we close it and only count up to the last heartbeat.
//
// HOW TO CHANGE: edit the three constants just below.
// =============================================================================

/** Idle gap (since last heartbeat) after which an open session auto-closes. */
export const IDLE_TIMEOUT_SEC = 5 * 60;
/** Maximum credited duration; sessions cannot run (or be credited) past this. */
export const HARD_CAP_SEC = 4 * 60 * 60;
/** Client heartbeat cadence while the tab is visible. */
export const HEARTBEAT_INTERVAL_SEC = 30;

export interface OpenSessionTiming {
  startedAtMs: number;
  /** Last server-confirmed heartbeat; null if none recorded yet. */
  lastHeartbeatMs: number | null;
}

/** Credited (capped, non-negative) duration in seconds between two instants. */
export function creditedDurationSec(startedAtMs: number, endMs: number): number {
  const raw = Math.floor((endMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(raw, HARD_CAP_SEC));
}

export type AutoCloseReason = "idle" | "cap";

export interface AutoCloseDecision {
  shouldClose: boolean;
  reason: AutoCloseReason | null;
  /** Instant to credit the session up to when closing. */
  endMs: number;
}

/**
 * Decide whether an open session should be auto-closed at `nowMs`.
 * - Hard cap wins first: credit only up to startedAt + cap.
 * - Idle: if the gap since the last heartbeat exceeds the idle timeout, credit
 *   only up to that last heartbeat (the user likely left without stopping).
 * Otherwise the session stays open and is credited up to `nowMs` when read.
 */
export function autoCloseDecision(
  t: OpenSessionTiming,
  nowMs: number,
): AutoCloseDecision {
  const capEndMs = t.startedAtMs + HARD_CAP_SEC * 1000;
  if (nowMs >= capEndMs) {
    return { shouldClose: true, reason: "cap", endMs: capEndMs };
  }

  const lastBeatMs = t.lastHeartbeatMs ?? t.startedAtMs;
  if (nowMs - lastBeatMs >= IDLE_TIMEOUT_SEC * 1000) {
    return { shouldClose: true, reason: "idle", endMs: lastBeatMs };
  }

  return { shouldClose: false, reason: null, endMs: nowMs };
}
