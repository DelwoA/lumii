-- AlterEnum
-- Add IMAGE as a material type. Kept in its own migration so the new enum value
-- is committed before any later migration references it (Postgres forbids using a
-- freshly added enum value in the same transaction that adds it).
ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'IMAGE';
