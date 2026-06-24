-- Mood check-ins now store the user's own description plus an AI heading + mood,
-- and are kept until the user deletes them (expiresAt becomes optional).
ALTER TABLE "MoodCheckin" ADD COLUMN "description" TEXT;
ALTER TABLE "MoodCheckin" ADD COLUMN "heading" TEXT;
ALTER TABLE "MoodCheckin" ADD COLUMN "mood" TEXT;
ALTER TABLE "MoodCheckin" ADD COLUMN "valence" TEXT;
ALTER TABLE "MoodCheckin" ALTER COLUMN "expiresAt" DROP NOT NULL;
