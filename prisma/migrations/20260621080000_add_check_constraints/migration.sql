-- Integrity CHECK constraints (Prisma does not model these, so they are not
-- subject to drift detection). The "one open StudySession per user" rule is
-- enforced transactionally in application code (see lib/services/session).

-- Material file/note union (lenient across the upload lifecycle).
ALTER TABLE "Material" ADD CONSTRAINT "material_type_fields_ck" CHECK (
  ("type" = 'NOTE' AND "noteText" IS NOT NULL AND "r2Key" IS NULL)
  OR ("type" = 'PDF' AND "noteText" IS NULL)
);

-- Quiz completion: non-negative counts; correct cannot exceed total.
ALTER TABLE "QuizCompletion" ADD CONSTRAINT "quiz_counts_ck" CHECK (
  "questionCount" >= 0 AND "correctCount" >= 0
  AND "correctCount" <= "questionCount" AND "durationSec" >= 0
);

-- Study session: non-negative durations/counters; quality score in 0..100.
ALTER TABLE "StudySession" ADD CONSTRAINT "study_session_ranges_ck" CHECK (
  ("actualDurationSec" IS NULL OR "actualDurationSec" >= 0)
  AND ("qualityScore" IS NULL OR ("qualityScore" >= 0 AND "qualityScore" <= 100))
  AND "summariesViewed" >= 0 AND "tutorQuestions" >= 0
  AND "quizAttempts" >= 0 AND "explanationsReviewed" >= 0
);

-- Scheduled session: positive target; end after start.
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "scheduled_session_ck" CHECK (
  "targetDurationSec" > 0 AND "plannedEnd" > "plannedStart"
);

-- Gamification: non-negative totals.
ALTER TABLE "GamificationProfile" ADD CONSTRAINT "gamification_nonneg_ck" CHECK (
  "totalXp" >= 0 AND "currentStreak" >= 0 AND "longestStreak" >= 0
);
