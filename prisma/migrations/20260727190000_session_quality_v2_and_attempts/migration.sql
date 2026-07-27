-- Session Quality v2: persist score state and explainable breakdowns, record
-- metadata-only verified activity, and allow multiple attempts per plan.
CREATE TYPE "SessionScoreStatus" AS ENUM (
  'PENDING',
  'SCORED',
  'TOO_SHORT',
  'NO_TARGET'
);

CREATE TYPE "SessionActivityType" AS ENUM (
  'SUMMARY_GENERATED',
  'TUTOR_QUESTION',
  'QUIZ_COMPLETED'
);

ALTER TABLE "StudySession"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Study session',
  ADD COLUMN "goal" TEXT,
  ADD COLUMN "subjectId" TEXT,
  ADD COLUMN "topicId" TEXT,
  ADD COLUMN "scoreStatus" "SessionScoreStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "qualityBreakdown" JSONB;

-- Preserve the plan's labels on existing attempts so history remains useful
-- even if a plan or taxonomy entry is later renamed.
UPDATE "StudySession" AS study
SET
  "title" = scheduled."title",
  "goal" = scheduled."goal",
  "subjectId" = scheduled."subjectId",
  "topicId" = scheduled."topicId"
FROM "ScheduledSession" AS scheduled
WHERE study."scheduledSessionId" = scheduled."id";

UPDATE "StudySession"
SET "scoreStatus" = CASE
  WHEN "qualityScore" IS NOT NULL THEN 'SCORED'::"SessionScoreStatus"
  WHEN "endedAt" IS NULL THEN 'PENDING'::"SessionScoreStatus"
  WHEN "targetDurationSec" IS NULL OR "targetDurationSec" <= 0
    THEN 'NO_TARGET'::"SessionScoreStatus"
  ELSE 'TOO_SHORT'::"SessionScoreStatus"
END;

DROP INDEX "StudySession_scheduledSessionId_key";
CREATE INDEX "StudySession_scheduledSessionId_idx"
  ON "StudySession"("scheduledSessionId");
CREATE INDEX "StudySession_subjectId_idx" ON "StudySession"("subjectId");
CREATE INDEX "StudySession_topicId_idx" ON "StudySession"("topicId");

ALTER TABLE "StudySession"
  ADD CONSTRAINT "StudySession_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudySession"
  ADD CONSTRAINT "StudySession_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SessionActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" "SessionActivityType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionActivity_sessionId_type_sourceId_key"
  ON "SessionActivity"("sessionId", "type", "sourceId");
CREATE INDEX "SessionActivity_userId_createdAt_idx"
  ON "SessionActivity"("userId", "createdAt");
CREATE INDEX "SessionActivity_sessionId_type_idx"
  ON "SessionActivity"("sessionId", "type");

ALTER TABLE "SessionActivity"
  ADD CONSTRAINT "SessionActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionActivity"
  ADD CONSTRAINT "SessionActivity_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
