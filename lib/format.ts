// =============================================================================
// FILE: lib/format.ts
// WHAT THIS FILE DOES:
//   Turns a number of seconds into friendly text for display.
//     - formatClock: a live timer like "05:09" or "1:05:09" (used by the
//       running-session bar).
//     - formatDurationShort: a compact total like "1h 23m", "23m", or "45s"
//       (used on the dashboard and progress cards).
//   Pure helpers with no side effects.
// =============================================================================
/** Duration + clock formatting shared across the session bar, dashboard, etc. */

/** A running clock: "MM:SS", or "H:MM:SS" once past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A compact human duration: "1h 23m", "23m", or "45s". */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
