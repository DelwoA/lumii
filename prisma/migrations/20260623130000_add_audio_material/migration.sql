-- AlterEnum
-- Audio materials: a new material type plus an interim status while the upload
-- is being transcribed. Kept in their own migration so the new enum values are
-- committed before any later migration references them.
ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'AUDIO';
ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'TRANSCRIBING';
