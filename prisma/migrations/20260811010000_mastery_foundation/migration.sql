-- Detailed quiz history, material knowledge components, and mastery snapshots.
-- Existing QuizCompletion rows remain valid summary-only history.

CREATE TYPE "KnowledgeComponentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'ARCHIVED');
CREATE TYPE "KnowledgeComponentOrigin" AS ENUM ('AI', 'MANUAL');
CREATE TYPE "QuizMode" AS ENUM ('QUICK', 'STANDARD');
CREATE TYPE "MasteryModelSource" AS ENUM ('BKT', 'DEEP', 'BKT_FALLBACK');

ALTER TABLE "QuizCompletion"
  ADD COLUMN "mode" "QuizMode" NOT NULL DEFAULT 'QUICK',
  ADD COLUMN "materialTitle" TEXT,
  ADD COLUMN "subjectName" TEXT,
  ADD COLUMN "topicName" TEXT;

CREATE TABLE "KnowledgeComponent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "KnowledgeComponentStatus" NOT NULL DEFAULT 'PROPOSED',
  "origin" "KnowledgeComponentOrigin" NOT NULL DEFAULT 'AI',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialKnowledgeComponent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "knowledgeComponentId" TEXT NOT NULL,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MaterialKnowledgeComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizQuestionAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quizCompletionId" TEXT NOT NULL,
  "knowledgeComponentId" TEXT,
  "componentName" TEXT,
  "position" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "chosenOption" INTEGER,
  "correctOption" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "explanation" TEXT,
  "responseTimeMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizQuestionAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizQuestionAttempt_position_check" CHECK ("position" >= 0),
  CONSTRAINT "QuizQuestionAttempt_correct_option_check" CHECK ("correctOption" BETWEEN 0 AND 3),
  CONSTRAINT "QuizQuestionAttempt_chosen_option_check" CHECK ("chosenOption" IS NULL OR "chosenOption" BETWEEN 0 AND 3),
  CONSTRAINT "QuizQuestionAttempt_response_time_check" CHECK ("responseTimeMs" IS NULL OR "responseTimeMs" >= 0)
);

CREATE TABLE "StudentConceptMastery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "knowledgeComponentId" TEXT NOT NULL,
  "masteryProbability" DOUBLE PRECISION NOT NULL,
  "nextCorrectProbability" DOUBLE PRECISION NOT NULL,
  "evidenceCount" INTEGER NOT NULL,
  "source" "MasteryModelSource" NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentConceptMastery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentConceptMastery_mastery_probability_check" CHECK ("masteryProbability" BETWEEN 0 AND 1),
  CONSTRAINT "StudentConceptMastery_next_correct_probability_check" CHECK ("nextCorrectProbability" BETWEEN 0 AND 1),
  CONSTRAINT "StudentConceptMastery_evidence_count_check" CHECK ("evidenceCount" >= 0)
);

CREATE TABLE "MasterySnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "knowledgeComponentId" TEXT NOT NULL,
  "quizCompletionId" TEXT NOT NULL,
  "masteryProbability" DOUBLE PRECISION NOT NULL,
  "nextCorrectProbability" DOUBLE PRECISION NOT NULL,
  "evidenceCount" INTEGER NOT NULL,
  "source" "MasteryModelSource" NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MasterySnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MasterySnapshot_mastery_probability_check" CHECK ("masteryProbability" BETWEEN 0 AND 1),
  CONSTRAINT "MasterySnapshot_next_correct_probability_check" CHECK ("nextCorrectProbability" BETWEEN 0 AND 1),
  CONSTRAINT "MasterySnapshot_evidence_count_check" CHECK ("evidenceCount" >= 0)
);

CREATE UNIQUE INDEX "KnowledgeComponent_topicId_normalizedName_key" ON "KnowledgeComponent"("topicId", "normalizedName");
CREATE INDEX "KnowledgeComponent_userId_status_idx" ON "KnowledgeComponent"("userId", "status");
CREATE INDEX "KnowledgeComponent_topicId_status_idx" ON "KnowledgeComponent"("topicId", "status");
CREATE UNIQUE INDEX "MaterialKnowledgeComponent_materialId_knowledgeComponentId_key" ON "MaterialKnowledgeComponent"("materialId", "knowledgeComponentId");
CREATE INDEX "MaterialKnowledgeComponent_userId_idx" ON "MaterialKnowledgeComponent"("userId");
CREATE INDEX "MaterialKnowledgeComponent_knowledgeComponentId_idx" ON "MaterialKnowledgeComponent"("knowledgeComponentId");
CREATE UNIQUE INDEX "QuizQuestionAttempt_quizCompletionId_position_key" ON "QuizQuestionAttempt"("quizCompletionId", "position");
CREATE INDEX "QuizQuestionAttempt_userId_createdAt_idx" ON "QuizQuestionAttempt"("userId", "createdAt");
CREATE INDEX "QuizQuestionAttempt_knowledgeComponentId_createdAt_idx" ON "QuizQuestionAttempt"("knowledgeComponentId", "createdAt");
CREATE UNIQUE INDEX "StudentConceptMastery_userId_knowledgeComponentId_key" ON "StudentConceptMastery"("userId", "knowledgeComponentId");
CREATE INDEX "StudentConceptMastery_userId_updatedAt_idx" ON "StudentConceptMastery"("userId", "updatedAt");
CREATE UNIQUE INDEX "MasterySnapshot_quizCompletionId_knowledgeComponentId_key" ON "MasterySnapshot"("quizCompletionId", "knowledgeComponentId");
CREATE INDEX "MasterySnapshot_userId_createdAt_idx" ON "MasterySnapshot"("userId", "createdAt");
CREATE INDEX "MasterySnapshot_knowledgeComponentId_createdAt_idx" ON "MasterySnapshot"("knowledgeComponentId", "createdAt");

ALTER TABLE "KnowledgeComponent" ADD CONSTRAINT "KnowledgeComponent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeComponent" ADD CONSTRAINT "KnowledgeComponent_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialKnowledgeComponent" ADD CONSTRAINT "MaterialKnowledgeComponent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialKnowledgeComponent" ADD CONSTRAINT "MaterialKnowledgeComponent_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialKnowledgeComponent" ADD CONSTRAINT "MaterialKnowledgeComponent_knowledgeComponentId_fkey"
  FOREIGN KEY ("knowledgeComponentId") REFERENCES "KnowledgeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizQuestionAttempt" ADD CONSTRAINT "QuizQuestionAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizQuestionAttempt" ADD CONSTRAINT "QuizQuestionAttempt_quizCompletionId_fkey"
  FOREIGN KEY ("quizCompletionId") REFERENCES "QuizCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizQuestionAttempt" ADD CONSTRAINT "QuizQuestionAttempt_knowledgeComponentId_fkey"
  FOREIGN KEY ("knowledgeComponentId") REFERENCES "KnowledgeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentConceptMastery" ADD CONSTRAINT "StudentConceptMastery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentConceptMastery" ADD CONSTRAINT "StudentConceptMastery_knowledgeComponentId_fkey"
  FOREIGN KEY ("knowledgeComponentId") REFERENCES "KnowledgeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MasterySnapshot" ADD CONSTRAINT "MasterySnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MasterySnapshot" ADD CONSTRAINT "MasterySnapshot_knowledgeComponentId_fkey"
  FOREIGN KEY ("knowledgeComponentId") REFERENCES "KnowledgeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MasterySnapshot" ADD CONSTRAINT "MasterySnapshot_quizCompletionId_fkey"
  FOREIGN KEY ("quizCompletionId") REFERENCES "QuizCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
