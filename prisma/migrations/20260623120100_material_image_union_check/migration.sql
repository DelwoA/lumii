-- Generalize the Material file/note union CHECK so it covers every file type
-- (PDF, IMAGE, and any future file type) rather than naming PDF explicitly.
-- A note carries noteText and no file; any non-note (file) material has no
-- noteText. Phrased as "type <> 'NOTE'" so it never references a newly added
-- enum value literal.
ALTER TABLE "Material" DROP CONSTRAINT IF EXISTS "material_type_fields_ck";

ALTER TABLE "Material" ADD CONSTRAINT "material_type_fields_ck" CHECK (
  ("type" = 'NOTE' AND "noteText" IS NOT NULL AND "r2Key" IS NULL)
  OR ("type" <> 'NOTE' AND "noteText" IS NULL)
);
