/** XP awards. Fixed + capped to keep gamification meaningful (anti-gaming). */
export const XP_RULES = {
  QUIZ_COMPLETED_BASE: 10,
  QUIZ_PER_CORRECT: 4,
  QUIZ_MAX: 50,
  SESSION_COMPLETED_BASE: 20,
  SESSION_QUALITY_BONUS_MAX: 20,
  SUMMARY_GENERATED: 5,
  ADHERENT_DAY: 15,
  PERFECT_DAY: 25,
  DAILY_CAP: 200,
} as const;

/** XP for a completed quiz: base + per-correct, capped. */
export function quizXp(correctCount: number, questionCount: number): number {
  const total = Math.max(0, Math.floor(questionCount));
  const correct = Math.min(Math.max(0, Math.floor(correctCount)), total);
  return Math.min(
    XP_RULES.QUIZ_MAX,
    XP_RULES.QUIZ_COMPLETED_BASE + correct * XP_RULES.QUIZ_PER_CORRECT,
  );
}

/** XP for a completed session: base + a bonus scaled by the quality score. */
export function sessionXp(qualityScore: number): number {
  const q = Math.max(0, Math.min(100, Math.floor(qualityScore)));
  const bonus = Math.round((q / 100) * XP_RULES.SESSION_QUALITY_BONUS_MAX);
  return XP_RULES.SESSION_COMPLETED_BASE + bonus;
}

/**
 * Apply the daily XP cap. Given how much XP was already earned today and a
 * requested award, returns the grantable amount (never negative).
 */
export function applyDailyCap(earnedToday: number, requestedDelta: number): number {
  const earned = Math.max(0, earnedToday);
  const remaining = Math.max(0, XP_RULES.DAILY_CAP - earned);
  return Math.max(0, Math.min(Math.max(0, requestedDelta), remaining));
}
