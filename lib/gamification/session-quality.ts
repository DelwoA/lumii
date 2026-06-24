// =============================================================================
// FILE: lib/gamification/session-quality.ts
// WHAT THIS FILE DOES:
//   Works out the "Session Quality" score (out of 100) shown after a study
//   session. IMPORTANT for the viva: this measures STUDY HABITS, not how clever
//   the student is or how much they learned. It is fully deterministic (the same
//   inputs always give the same score), so it is fair and explainable.
//
// THE 100 POINTS ARE MADE OF:
//   - up to 40: how close the time studied was to the planned target.
//   - 15: the student pressed Stop themselves (not auto-closed).
//   - 15: the student ticked that they met their goal.
//   - up to 30: bounded in-session activity (viewing summaries, tutor questions,
//     quiz attempts, explanations reviewed), each capped so it cannot be farmed.
//
// HOW TO CHANGE: edit the caps in ENGAGEMENT_CAPS or the point values in
//   computeSessionQuality, and bump SESSION_QUALITY_VERSION so older scores stay
//   labelled with the rules that produced them.
//
// Only sessions of at least MIN_SCORED_DURATION_SEC (10 minutes) are scored.
// Pure maths (no database); unit-tested in session-quality.test.ts.
// =============================================================================

/**
 * Session Quality = a deterministic product-engagement + session-discipline
 * score out of 100. It is NOT a measure of learning, attention, or ability.
 * Weights are published and fixed; bump SESSION_QUALITY_VERSION on any change.
 */
export const SESSION_QUALITY_VERSION = "1";

/** A session must run at least this long to be scored. */
export const MIN_SCORED_DURATION_SEC = 10 * 60;

/** Point caps for bounded engagement (sum = 30). */
const ENGAGEMENT_CAPS = {
  summariesViewed: 5,
  tutorQuestions: 10,
  quizAttempts: 10,
  explanationsReviewed: 5,
} as const;

export interface SessionQualityInput {
  creditedDurationSec: number;
  targetDurationSec: number;
  explicitStop: boolean;
  goalCompleted: boolean;
  autoClosed: boolean;
  summariesViewed: number;
  tutorQuestions: number;
  quizAttempts: number;
  explanationsReviewed: number;
}

export interface SessionQualityBreakdown {
  durationAdherence: number; // 0..40
  explicitStop: number; // 0 | 15
  goalCompletion: number; // 0 | 15
  engagement: number; // 0..30
  total: number; // 0..100
}

function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function computeSessionQuality(
  input: SessionQualityInput,
): SessionQualityBreakdown {
  const target = clampNonNeg(input.targetDurationSec);
  const credited = clampNonNeg(input.creditedDurationSec);

  const durationAdherence =
    target > 0 ? Math.round(40 * Math.min(credited / target, 1)) : 0;

  // Auto-closed sessions earn neither the explicit-stop nor goal points.
  const explicitStop = !input.autoClosed && input.explicitStop ? 15 : 0;
  const goalCompletion = !input.autoClosed && input.goalCompleted ? 15 : 0;

  const engagement =
    Math.min(clampNonNeg(input.summariesViewed), ENGAGEMENT_CAPS.summariesViewed) +
    Math.min(clampNonNeg(input.tutorQuestions), ENGAGEMENT_CAPS.tutorQuestions) +
    Math.min(clampNonNeg(input.quizAttempts), ENGAGEMENT_CAPS.quizAttempts) +
    Math.min(
      clampNonNeg(input.explanationsReviewed),
      ENGAGEMENT_CAPS.explanationsReviewed,
    );

  const total = Math.max(
    0,
    Math.min(100, durationAdherence + explicitStop + goalCompletion + engagement),
  );

  return { durationAdherence, explicitStop, goalCompletion, engagement, total };
}
