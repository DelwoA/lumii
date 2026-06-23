import { z } from "zod";

export const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB
export const PDF_CONTENT_TYPE = "application/pdf";

/**
 * Multipart tuning. Files larger than the threshold upload as resumable
 * multipart (one presigned PUT per part); smaller files take the single-PUT
 * fast path. R2 requires every part except the last to share one size and be
 * at least 5 MB, so the threshold and the part size are the same value.
 */
export const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10 MB per part
export const MULTIPART_THRESHOLD = MULTIPART_PART_SIZE;

const MAX_FILE_LABEL = "File must be 200 MB or less";

/** Client requests a presigned upload for a PDF (single-PUT or multipart). */
export const requestUploadInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  subjectId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  fileName: z.string().min(1).max(200),
  contentType: z.literal(PDF_CONTENT_TYPE, {
    message: "Only PDF files are supported",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive("File looks empty")
    .max(MAX_FILE_BYTES, MAX_FILE_LABEL),
});
export type RequestUploadInput = z.infer<typeof requestUploadInput>;

/** Client reports the uploaded parts so the server can complete the upload. */
export const completeMultipartInput = z.object({
  materialId: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .min(1, "No uploaded parts"),
});
export type CompleteMultipartInput = z.infer<typeof completeMultipartInput>;

/** Client asks to abandon an in-progress multipart upload. */
export const abortMultipartInput = z.object({
  materialId: z.string().min(1),
  uploadId: z.string().min(1),
});
export type AbortMultipartInput = z.infer<typeof abortMultipartInput>;

/** Typed-note material (no file). */
export const noteInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  subjectId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  text: z
    .string()
    .trim()
    .min(1, "Note text is required")
    .max(50_000, "Note is too long"),
});
export type NoteInput = z.infer<typeof noteInput>;
