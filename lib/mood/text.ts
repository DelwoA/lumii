/**
 * Pure text helpers for mood check-ins. Kept free of server-only imports so the
 * clamp can be unit tested and shared between the AI analysis and the storage
 * path (guaranteeing the stored text is exactly what was analysed).
 */

/** Max characters of a check-in we analyse AND store (a single clamp upstream). */
export const MAX_MOOD_CHARS = 1000;

/**
 * Normalise a raw check-in to exactly what we both analyse and store. Idempotent
 * (the trailing trim removes any whitespace the length cut may have exposed) so
 * the stored text and the analysed text are always identical.
 */
export function clampMoodText(value: string): string {
  return value.trim().slice(0, MAX_MOOD_CHARS).trim();
}
