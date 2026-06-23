-- Store the model-generated transcript for audio materials. The existing
-- material_type_fields_ck (note has noteText, any file type has none) already
-- covers AUDIO as a file type, so no constraint change is needed.
ALTER TABLE "Material" ADD COLUMN "transcript" TEXT;
