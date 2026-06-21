import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { withModelFallback, materialUserContent } from "@/lib/ai/provider";
import type { MaterialAIContent } from "@/lib/materials/content";

export const QUIZ_GENERATION_VERSION = "1";
export const QUIZ_QUESTION_COUNT = 5;

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctAnswer: z.number().int().min(0).max(3),
        explanation: z.string(),
      }),
    )
    .length(QUIZ_QUESTION_COUNT),
});
export type GeneratedQuiz = z.infer<typeof quizSchema>;

const QUIZ_SYSTEM = `You are an expert assessment writer. From the provided study material, write exactly ${QUIZ_QUESTION_COUNT} multiple-choice questions.

Rules:
- Each question has exactly 4 options with exactly one correct answer.
- "correctAnswer" is the 0-based index (0-3) of the correct option.
- Cover the key concepts; vary difficulty from recall to application.
- Make distractors plausible but clearly incorrect; keep options similar in length.
- Avoid "all of the above" / "none of the above".
- Provide a one-sentence "explanation" for why the correct option is right.
- Base every question ONLY on the material; never invent facts.`;

export async function generateQuiz(
  material: MaterialAIContent,
): Promise<{ quiz: GeneratedQuiz; modelId: string }> {
  const instruction = `Create a ${QUIZ_QUESTION_COUNT}-question multiple-choice quiz from the material titled "${material.title}".`;
  const { result, modelId } = await withModelFallback((model) =>
    generateObject({
      model,
      schema: quizSchema,
      system: QUIZ_SYSTEM,
      messages: [
        { role: "user", content: materialUserContent(instruction, material) },
      ],
      temperature: 0.6,
    }),
  );
  return { quiz: result.object, modelId };
}
