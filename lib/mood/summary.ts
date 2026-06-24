// =============================================================================
// FILE: lib/mood/summary.ts
// WHAT THIS FILE DOES:
//   The pure rules for the "average feeling" shown on the Progress page. Given
//   counts of positive / neutral / negative check-ins over the recent window, it
//   produces a friendly headline ("Mostly positive lately", and so on). No
//   database here, so it is easy to unit-test (see summary.test.ts); the server
//   query that gathers the counts lives in lib/mood/service.ts.
// =============================================================================

/** Rolling window the deterministic mood summary is computed over. */
export const MOOD_WINDOW_DAYS = 14;

export interface MoodSummary {
  headline: string;
  pos: number;
  neu: number;
  neg: number;
  total: number;
}

/**
 * Build the deterministic summary from valence counts. Returns null when there
 * is nothing in the window so the caller can hide the summary entirely.
 */
export function buildMoodSummary(counts: {
  pos: number;
  neu: number;
  neg: number;
}): MoodSummary | null {
  const { pos, neu, neg } = counts;
  const total = pos + neu + neg;
  if (total === 0) return null;
  const headline =
    pos > neu && pos > neg
      ? "Mostly positive lately"
      : neg > neu && neg > pos
        ? "A tough stretch lately"
        : "A balanced mix lately";
  return { headline, pos, neu, neg, total };
}
