-- Add a server-controlled difficulty label for product-matched mastery inference.
-- Existing detailed attempts remain valid and represent a typical medium item.

CREATE TYPE "QuizDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

ALTER TABLE "QuizQuestionAttempt"
  ADD COLUMN "difficulty" "QuizDifficulty" NOT NULL DEFAULT 'MEDIUM';
