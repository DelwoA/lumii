/**
 * Pure helpers for the "average feeling" summary on the Progress page. Kept free
 * of server-only imports so the summary shape + headline rules can be unit tested
 * and shared between the server query and the client-rendered component.
 */

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
