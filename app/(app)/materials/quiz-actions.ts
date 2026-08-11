"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import {
  generateQuiz,
  QUICK_QUIZ_COUNT,
  QUIZ_GENERATION_VERSION,
  STANDARD_QUIZ_COUNT,
  type QuizTarget,
} from "@/lib/ai/quiz";
import {
  encryptQuizToken,
  decryptQuizToken,
  scoreQuiz,
  type QuizAnswerKey,
} from "@/lib/quiz/token";
import { quizXp } from "@/lib/gamification/xp";
import { awardXp } from "@/lib/gamification/award";
import { getCurrentRank, runAwardChecks } from "@/lib/gamification/service";
import { recordSessionActivity } from "@/lib/sessions/service";
import {
  getMasteryOverview,
  recomputeMasteryForComponents,
} from "@/lib/mastery/service";
import type {
  QuizDifficulty,
  QuizMode,
  QuizQuestionPublic,
  GradedQuestion,
  StartQuizResult,
  SubmitQuizResult,
} from "@/lib/quiz/types";

const DIFFICULTY_PATTERN: readonly QuizDifficulty[] = [
  "EASY",
  "MEDIUM",
  "MEDIUM",
  "HARD",
  "MEDIUM",
];

function buildTargetSequence(
  components: Array<{
    id: string;
    name: string;
    description: string;
    mastery: Array<{ masteryProbability: number }>;
  }>,
  count: number,
  targetedComponentId?: string,
): QuizTarget[] {
  if (targetedComponentId) {
    const target = components.find(
      (component) => component.id === targetedComponentId,
    );
    if (!target) throw new Error("Selected concept is unavailable");
    return Array.from({ length: count }, (_, index) => ({
      id: target.id,
      name: target.name,
      description: target.description,
      difficulty: DIFFICULTY_PATTERN[index % DIFFICULTY_PATTERN.length]!,
    }));
  }

  const ordered = components.toSorted((a, b) => {
    const aMastery = a.mastery[0]?.masteryProbability;
    const bMastery = b.mastery[0]?.masteryProbability;
    if (aMastery == null && bMastery != null) return -1;
    if (aMastery != null && bMastery == null) return 1;
    return (aMastery ?? 0) - (bMastery ?? 0);
  });
  const pool = ordered.slice(0, Math.min(5, ordered.length));
  return Array.from({ length: count }, (_, index) => {
    const component = pool[index % pool.length]!;
    return {
      id: component.id,
      name: component.name,
      description: component.description,
      difficulty: DIFFICULTY_PATTERN[index % DIFFICULTY_PATTERN.length]!,
    };
  });
}
export async function startQuiz(input: {
  materialId: string;
  mode: QuizMode;
  componentId?: string;
}): Promise<StartQuizResult> {
  const user = await requireDbUser();
  const loaded = await loadMaterialForAI(user.id, input.materialId);
  if (!loaded) return { ok: false, error: "Material is not ready yet" };
  if (!loaded.topicId) {
    return {
      ok: false,
      error: "Assign this material to a topic before generating a quiz.",
    };
  }

  const links = await prisma.materialKnowledgeComponent.findMany({
    where: {
      materialId: input.materialId,
      userId: user.id,
      knowledgeComponent: { status: "CONFIRMED" },
    },
    include: {
      knowledgeComponent: {
        include: { mastery: { where: { userId: user.id }, take: 1 } },
      },
    },
  });
  const components = links.map((link) => link.knowledgeComponent);
  if (components.length === 0) {
    return {
      ok: false,
      error: "Confirm this material's concept map before generating a quiz.",
    };
  }

  try {
    const count =
      input.mode === "STANDARD" ? STANDARD_QUIZ_COUNT : QUICK_QUIZ_COUNT;
    const targets = buildTargetSequence(components, count, input.componentId);
    const { quiz, modelId } = await generateQuiz(loaded.content, targets);
    const quizInstanceId = randomUUID();
    const canonicalQuestions = quiz.questions.map((question, index) => ({
      id: index,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
      componentId: question.componentId,
      componentName: question.componentName,
      difficulty: question.difficulty,
    }));
    const token = await encryptQuizToken({
      quizInstanceId,
      userId: user.id,
      materialId: input.materialId,
      mode: input.mode,
      questionCount: canonicalQuestions.length,
      questions: canonicalQuestions,
      modelId,
      generationVersion: QUIZ_GENERATION_VERSION,
    });
    const questions: QuizQuestionPublic[] = canonicalQuestions.map(
      ({ correctAnswer: _correct, explanation: _explanation, ...question }) => {
        void _correct;
        void _explanation;
        return question;
      },
    );
    return { ok: true, token, questions };
  } catch {
    return {
      ok: false,
      error: "Could not generate a concept-aligned quiz. Please try again.",
    };
  }
}

export async function submitQuiz(input: {
  materialId: string;
  token: string;
  answers: (number | null)[];
  responseTimesMs?: (number | null)[];
  durationSec: number;
}): Promise<SubmitQuizResult> {
  const user = await requireDbUser();

  let key: QuizAnswerKey;
  try {
    key = await decryptQuizToken(input.token);
  } catch {
    return {
      ok: false,
      error: "This quiz has expired. Please generate a new one.",
    };
  }
  if (key.userId !== user.id || key.materialId !== input.materialId) {
    return { ok: false, error: "This quiz does not match your session." };
  }

  const answers = key.questions.map((_, index) => {
    const answer = input.answers[index];
    return Number.isInteger(answer) && answer! >= 0 && answer! <= 3
      ? answer!
      : null;
  });
  const correctAnswers = key.questions.map(
    (question) => question.correctAnswer,
  );
  const { correctCount, questionCount } = scoreQuiz(correctAnswers, answers);

  const meta = await prisma.material.findFirst({
    where: { id: input.materialId, userId: user.id },
    select: {
      title: true,
      subjectId: true,
      topicId: true,
      subject: { select: { name: true } },
      topic: { select: { name: true } },
    },
  });
  if (!meta) return { ok: false, error: "Material not found." };

  const rankBefore = await getCurrentRank(user.id);
  let xpAwarded = 0;
  let completionId: string | null = null;
  let created = false;
  try {
    const completion = await prisma.quizCompletion.create({
      data: {
        userId: user.id,
        subjectId: meta.subjectId,
        topicId: meta.topicId,
        materialId: input.materialId,
        materialTitle: meta.title,
        subjectName: meta.subject?.name ?? null,
        topicName: meta.topic?.name ?? null,
        questionCount,
        correctCount,
        durationSec: Math.min(
          14_400,
          Math.max(0, Math.floor(input.durationSec)),
        ),
        mode: key.mode,
        modelId: key.modelId,
        generationVersion: key.generationVersion,
        idempotencyKey: key.quizInstanceId,
        questionAttempts: {
          create: key.questions.map((question, index) => ({
            userId: user.id,
            knowledgeComponentId: question.componentId,
            componentName: question.componentName,
            difficulty: question.difficulty,
            position: index,
            question: question.question,
            options: question.options,
            chosenOption: answers[index],
            correctOption: question.correctAnswer,
            isCorrect: answers[index] === question.correctAnswer,
            explanation: question.explanation,
            responseTimeMs:
              input.responseTimesMs?.[index] == null
                ? null
                : Math.min(
                    14_400_000,
                    Math.max(0, Math.floor(input.responseTimesMs[index]!)),
                  ),
          })),
        },
      },
      select: { id: true },
    });
    completionId = completion.id;
    created = true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.quizCompletion.findUnique({
        where: { idempotencyKey: key.quizInstanceId },
        select: { id: true, userId: true },
      });
      if (existing?.userId !== user.id) {
        return { ok: false, error: "This quiz could not be recorded." };
      }
      completionId = existing.id;
    } else {
      return {
        ok: false,
        error: "Your answers were marked but the quiz could not be saved.",
      };
    }
  }

  if (created) {
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
    await recomputeMasteryForComponents({
      userId: user.id,
      componentIds: key.questions.map((question) => question.componentId),
      quizCompletionId: completionId!,
    });
  }

  await recordSessionActivity(user.id, "QUIZ_COMPLETED", key.quizInstanceId);
  const [celebration, overview] = await Promise.all([
    runAwardChecks(user.id, rankBefore),
    getMasteryOverview(user.id),
  ]);
  const affected = new Set(
    key.questions.map((question) => question.componentId),
  );
  const masteryUpdates = overview.components.filter((component) =>
    affected.has(component.componentId),
  );

  const graded: GradedQuestion[] = key.questions.map((question, index) => ({
    id: question.id,
    question: question.question,
    options: question.options,
    chosen: answers[index] ?? null,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    componentId: question.componentId,
    componentName: question.componentName,
    difficulty: question.difficulty,
  }));

  revalidatePath("/progress");
  revalidatePath("/progress/mastery");
  revalidatePath("/progress/quizzes");
  return {
    ok: true,
    correctCount,
    questionCount,
    graded,
    xpAwarded,
    masteryUpdates,
    celebration,
  };
}
