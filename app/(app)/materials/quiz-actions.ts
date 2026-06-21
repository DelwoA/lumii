"use server";

import { randomUUID } from "node:crypto";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import { generateQuiz, QUIZ_GENERATION_VERSION } from "@/lib/ai/quiz";
import {
  encryptQuizToken,
  decryptQuizToken,
  scoreQuiz,
  type QuizAnswerKey,
} from "@/lib/quiz/token";
import { quizXp } from "@/lib/gamification/xp";
import { awardXp } from "@/lib/gamification/award";
import { checkTrophies } from "@/lib/gamification/service";
import { bumpEngagement } from "@/lib/sessions/service";
import type {
  QuizQuestionPublic,
  GradedQuestion,
  StartQuizResult,
  SubmitQuizResult,
} from "@/lib/quiz/types";

/** Generate a quiz: returns questions WITHOUT the answer key, plus the encrypted token. */
export async function startQuiz(materialId: string): Promise<StartQuizResult> {
  const user = await requireDbUser();
  const loaded = await loadMaterialForAI(user.id, materialId);
  if (!loaded) return { ok: false, error: "Material is not ready yet" };

  try {
    const { quiz, modelId } = await generateQuiz(loaded.content);
    const quizInstanceId = randomUUID();
    const token = await encryptQuizToken({
      quizInstanceId,
      userId: user.id,
      materialId,
      questionCount: quiz.questions.length,
      correctAnswers: quiz.questions.map((q) => q.correctAnswer),
      explanations: quiz.questions.map((q) => q.explanation ?? null),
      modelId,
      generationVersion: QUIZ_GENERATION_VERSION,
    });
    const questions: QuizQuestionPublic[] = quiz.questions.map((q, i) => ({
      id: i,
      question: q.question,
      options: q.options,
    }));
    return { ok: true, token, questions };
  } catch {
    return { ok: false, error: "Could not generate the quiz. Please try again." };
  }
}

/** Submit answers: verify the token, recompute the score server-side, record the completion + XP. */
export async function submitQuiz(input: {
  materialId: string;
  token: string;
  questions: QuizQuestionPublic[];
  answers: (number | null)[];
  durationSec: number;
}): Promise<SubmitQuizResult> {
  const user = await requireDbUser();

  let key: QuizAnswerKey;
  try {
    key = await decryptQuizToken(input.token);
  } catch {
    return { ok: false, error: "This quiz has expired. Please generate a new one." };
  }
  if (key.userId !== user.id || key.materialId !== input.materialId) {
    return { ok: false, error: "This quiz does not match your session." };
  }

  const { correctCount, questionCount } = scoreQuiz(key.correctAnswers, input.answers);

  const meta = await prisma.material.findFirst({
    where: { id: input.materialId, userId: user.id },
    select: { subjectId: true, topicId: true },
  });

  let xpAwarded = 0;
  try {
    // The unique idempotencyKey makes a completion record at-most-once.
    await prisma.quizCompletion.create({
      data: {
        userId: user.id,
        subjectId: meta?.subjectId ?? null,
        topicId: meta?.topicId ?? null,
        materialId: input.materialId,
        questionCount,
        correctCount,
        durationSec: Math.max(0, Math.floor(input.durationSec)),
        modelId: key.modelId,
        generationVersion: key.generationVersion,
        idempotencyKey: key.quizInstanceId,
      },
    });
    const award = await awardXp({
      userId: user.id,
      type: "QUIZ_COMPLETED",
      requestedXp: quizXp(correctCount, questionCount),
      idempotencyKey: `quiz-completed:${key.quizInstanceId}`,
      sourceType: "quiz",
      sourceId: key.quizInstanceId,
      payload: { questionCount, correctCount },
    });
    xpAwarded = award.xpAwarded;
  } catch {
    // Duplicate submission (idempotencyKey clash) -> no additional XP.
    xpAwarded = 0;
  }

  // Best-effort engagement bump for any in-progress study session.
  await bumpEngagement(user.id, "quizAttempts");
  await checkTrophies(user.id);

  const graded: GradedQuestion[] = input.questions.map((q, i) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    chosen: input.answers[i] ?? null,
    correctAnswer: key.correctAnswers[i],
    explanation: key.explanations[i] ?? null,
  }));

  return { ok: true, correctCount, questionCount, graded, xpAwarded };
}
