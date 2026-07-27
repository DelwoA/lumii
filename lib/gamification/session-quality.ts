/**
 * Session Quality is a deterministic habit/follow-through score. It does not
 * claim to measure intelligence, focus, comprehension, or subject mastery.
 * Persist the version and breakdown with every score so historical records
 * remain explainable if the formula changes again.
 */
export const SESSION_QUALITY_VERSION = "2";
export const MIN_SCORED_DURATION_SEC = 10 * 60;

export interface SessionQualityActivity {
  summariesGenerated: number;
  tutorQuestions: number;
  quizzesCompleted: number;
}

export interface SessionQualityInput {
  creditedDurationSec: number;
  targetDurationSec: number;
  explicitStop: boolean;
  goalCompleted: boolean;
  autoClosed: boolean;
  activity: SessionQualityActivity;
}

export interface SessionQualityBreakdown {
  durationAdherence: number;
  goalCompletion: number;
  intentionalStop: number;
  learningActivity: number;
  total: number;
  activity: SessionQualityActivity;
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function duration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function computeSessionQuality(
  input: SessionQualityInput,
): SessionQualityBreakdown {
  const credited = duration(input.creditedDurationSec);
  const target = duration(input.targetDurationSec);
  const activity = {
    summariesGenerated: count(input.activity.summariesGenerated),
    tutorQuestions: count(input.activity.tutorQuestions),
    quizzesCompleted: count(input.activity.quizzesCompleted),
  };

  const durationAdherence =
    target > 0 ? Math.round(50 * Math.min(credited / target, 1)) : 0;
  const goalCompletion = !input.autoClosed && input.goalCompleted ? 20 : 0;
  const intentionalStop = !input.autoClosed && input.explicitStop ? 10 : 0;
  const learningActivity =
    Math.min(activity.summariesGenerated, 1) * 4 +
    Math.min(activity.tutorQuestions, 3) * 2 +
    Math.min(activity.quizzesCompleted, 1) * 10;

  const total = Math.min(
    100,
    durationAdherence + goalCompletion + intentionalStop + learningActivity,
  );

  return {
    durationAdherence,
    goalCompletion,
    intentionalStop,
    learningActivity,
    total,
    activity,
  };
}

/** Kept only for rendering older version-labelled records without rewriting. */
export interface LegacySessionQualityInput {
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

export function computeSessionQualityV1(input: LegacySessionQualityInput) {
  const target = duration(input.targetDurationSec);
  const credited = duration(input.creditedDurationSec);
  const durationAdherence =
    target > 0 ? Math.round(40 * Math.min(credited / target, 1)) : 0;
  const explicitStop = !input.autoClosed && input.explicitStop ? 15 : 0;
  const goalCompletion = !input.autoClosed && input.goalCompleted ? 15 : 0;
  const engagement =
    Math.min(count(input.summariesViewed), 5) +
    Math.min(count(input.tutorQuestions), 10) +
    Math.min(count(input.quizAttempts), 10) +
    Math.min(count(input.explanationsReviewed), 5);

  return {
    durationAdherence,
    explicitStop,
    goalCompletion,
    engagement,
    total: Math.min(
      100,
      durationAdherence + explicitStop + goalCompletion + engagement,
    ),
  };
}
