import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const PDF_CONTENT_TYPE = "application/pdf";

/** Client requests a presigned upload for a PDF. */
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
    .max(MAX_FILE_BYTES, "File must be 10 MB or less"),
});
export type RequestUploadInput = z.infer<typeof requestUploadInput>;

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
