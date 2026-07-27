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

/** Botanical, parchment-friendly subject colours with usable white contrast. */
export const SUBJECT_COLORS = [
  "#2F6048",
  "#496F56",
  "#6B7F52",
  "#5F756F",
  "#7B6754",
  "#8B5E55",
  "#5D6D82",
  "#6C657D",
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
