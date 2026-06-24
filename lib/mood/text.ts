// =============================================================================
// FILE: lib/mood/text.ts
// WHAT THIS FILE DOES:
//   Small, pure text helpers for the mood check-in: capping the length and
//   tidying the AI heading and mood words. "Pure" means no database and no
//   server-only code, so these can be unit-tested directly (see text.test.ts)
//   and used by both the analysis step and the saving step. Using the same
//   helper in both places guarantees the stored text matches what was analysed.
//
// HOW TO CHANGE: MAX_MOOD_CHARS sets the length limit; MOOD_MAX_WORDS sets how
//   many words a mood phrase may have; TRAILING_FILLER lists words a phrase
//   should not end on (so a cut never leaves a dangling "and").
// =============================================================================

/** Max characters of a check-in we analyse AND store (a single clamp upstream). */
export const MAX_MOOD_CHARS = 1000;

/** Word caps for the model's heading and mood (deterministic safety net). */
export const MOOD_HEADING_MAX_WORDS = 6;
export const MOOD_MAX_WORDS = 4;

/**
 * Normalise a raw check-in to exactly what we both analyse and store. Idempotent
 * (the trailing trim removes any whitespace the length cut may have exposed) so
 * the stored text and the analysed text are always identical.
 */
export function clampMoodText(value: string): string {
  return value.trim().slice(0, MAX_MOOD_CHARS).trim();
}

// Connective/filler words a short mood phrase should never end on, so a hard
// word cap can't leave a dangling fragment like "calm and on" (from "calm and
// on track"). Trimming these yields a clean phrase ("calm").
const TRAILING_FILLER = new Set([
  "and", "but", "or", "nor", "so", "yet",
  "a", "an", "the",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "as", "than", "into",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "i", "i'm", "im", "my", "me",
  "still", "very", "really", "quite", "just", "bit",
]);

/** Collapse whitespace, drop trailing punctuation, and cap words + length. */
export function tidyPhrase(
  value: string,
  maxWords: number,
  maxChars: number,
): string {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/[.,;:!"'\s]+$/g, "")
    .trim();
  return cleaned.split(" ").slice(0, maxWords).join(" ").slice(0, maxChars).trim();
}

/** Tidy the AI heading to a clean, capped Title-Case-ish phrase. */
export function tidyHeading(value: string): string {
  return tidyPhrase(value, MOOD_HEADING_MAX_WORDS, 60);
}

/**
 * Tidy the AI mood to a clean 1-4 word phrase, dropping any trailing connective
 * words the cap exposes so the result never ends on a dangling "and"/"on"/etc.
 */
export function tidyMood(value: string): string {
  const capped = tidyPhrase(value, MOOD_MAX_WORDS, 40);
  if (!capped) return "";
  const words = capped.split(" ");
  while (
    words.length > 1 &&
    TRAILING_FILLER.has(words[words.length - 1].toLowerCase())
  ) {
    words.pop();
  }
  return words.join(" ");
}
