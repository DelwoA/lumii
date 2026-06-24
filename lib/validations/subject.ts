// =============================================================================
// FILE: lib/validations/subject.ts
// WHAT THIS FILE DOES:
//   The rules (using Zod) for creating or editing a subject and a topic: the
//   name must be present and a sensible length, and the colour must be one of
//   the preset choices. Shared by the create/edit dialogs and the server.
//
// HOW TO CHANGE: edit SUBJECT_COLORS below to change the colour swatches offered.
// =============================================================================
import { z } from "zod";

/** Preset subject colours (the first is the Lumen lime accent). */
export const SUBJECT_COLORS = [
  "#CAF136",
  "#60A5FA",
  "#F472B6",
  "#FBBF24",
  "#34D399",
  "#A78BFA",
  "#F87171",
  "#94A3B8",
] as const;

export const subjectInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Keep it under 60 characters"),
  color: z.enum(SUBJECT_COLORS).optional(),
});

export const topicInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Keep it under 60 characters"),
});

export type SubjectInput = z.infer<typeof subjectInput>;
export type TopicInput = z.infer<typeof topicInput>;
