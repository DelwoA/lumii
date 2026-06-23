-- AlterEnum
-- A pre-transcription status so the transcription worker can atomically claim a
-- job (PENDING_TRANSCRIPTION -> TRANSCRIBING) and concurrent calls cannot both
-- proceed. Does not reference the new value in this migration.
ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'PENDING_TRANSCRIPTION';

-- A chunk's (materialId, chunkIndex) is a genuine invariant; the unique index
-- makes index rebuilds idempotent and guards against duplicate chunk rows.
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialChunk_materialId_chunkIndex_key"
  ON "MaterialChunk" ("materialId", "chunkIndex");
