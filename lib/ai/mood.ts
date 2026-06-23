import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import type { MoodLabel } from "@prisma/client";
import { withModelFallback } from "@/lib/ai/provider";

export const MOOD_LABELS = [
  "MOTIVATED",
  "NEUTRAL",
  "TIRED",
  "STRESSED",
  "FRUSTRATED",
] as const;

const moodSchema = z.object({
  label: z.enum(MOOD_LABELS),
  // Used only in-memory to gate a confident label; never stored.
  confidence: z.number().min(0).max(1),
});

const CONFIDENCE_FLOOR = 0.5;

const MOOD_SYSTEM = `You are a careful classifier. Read a student's short study check-in and label their study-related mood as exactly one of: MOTIVATED, NEUTRAL, TIRED, STRESSED, FRUSTRATED.

Guidance:
- Judge only the feeling about studying that the text expresses, not the subject they mention.
- MOTIVATED: energised, eager, confident. TIRED: low energy, sleepy, drained. STRESSED: anxious, overwhelmed, under time pressure. FRUSTRATED: stuck, annoyed, things not working. NEUTRAL: calm, matter-of-fact, or no clear feeling.
- Be conservative: if the text is ambiguous, mixed, empty of feeling, or off-topic, return NEUTRAL with low confidence.
- Set "confidence" honestly between 0 and 1 based on how clearly one mood dominates.
- This is a wellbeing signal, not a clinical or medical assessment; never diagnose.
- Output only the schema fields.`;

/**
 * Classify a free-text check-in into a mood label. The text is sent to the
 * model transiently for this single purpose and is NEVER persisted or logged.
 * A low-confidence result falls back to NEUTRAL rather than forcing a label.
 */
export async function classifyMood(text: string): Promise<{ label: MoodLabel | null }> {
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return { label: null };

  const { result } = await withModelFallback((model) =>
    generateObject({
      model,
      schema: moodSchema,
      system: MOOD_SYSTEM,
      prompt: `Student check-in:\n"""${trimmed}"""`,
      temperature: 0.2,
    }),
  );

  if (result.object.confidence < CONFIDENCE_FLOOR) return { label: "NEUTRAL" };
  return { label: result.object.label };
}
