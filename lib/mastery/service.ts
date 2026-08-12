import "server-only";
import { prisma } from "@/lib/prisma";
import { BKT_MODEL_VERSION, estimateBkt } from "@/lib/mastery/bkt";
import { predictNextCorrect } from "@/lib/mastery/inference";
import { chooseMasteryRecommendation } from "@/lib/mastery/recommendation";
import type { MasteryOverview, MasterySummary } from "@/lib/mastery/types";

export async function recomputeMasteryForComponents(input: {
  userId: string;
  componentIds: readonly string[];
  quizCompletionId?: string;
}) {
  const componentIds = [...new Set(input.componentIds)];
  if (componentIds.length === 0) return [];

  const attempts = await prisma.quizQuestionAttempt.findMany({
    where: {
      userId: input.userId,
      knowledgeComponentId: { not: null },
    },
    orderBy: [{ createdAt: "asc" }, { position: "asc" }],
    select: {
      knowledgeComponentId: true,
      isCorrect: true,
      responseTimeMs: true,
      createdAt: true,
      difficulty: true,
    },
  });

  const byComponent = new Map<
    string,
    {
      correct: boolean;
      responseTimeMs: number | null;
      createdAt: Date;
      componentId: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
    }[]
  >();
  for (const id of componentIds) byComponent.set(id, []);
  for (const attempt of attempts) {
    if (attempt.knowledgeComponentId) {
      byComponent.get(attempt.knowledgeComponentId)?.push({
        correct: attempt.isCorrect,
        responseTimeMs: attempt.responseTimeMs,
        createdAt: attempt.createdAt,
        componentId: attempt.knowledgeComponentId ?? "__unknown__",
        difficulty: attempt.difficulty,
      });
    }
  }

  const results = [];
  for (const componentId of componentIds) {
    const componentAttempts = byComponent.get(componentId) ?? [];
    if (componentAttempts.length === 0) {
      await prisma.studentConceptMastery.deleteMany({
        where: { userId: input.userId, knowledgeComponentId: componentId },
      });
      continue;
    }

    const estimate = estimateBkt(
      componentAttempts.map((attempt) => attempt.correct),
    );
    const deep = await predictNextCorrect(
      attempts.map((attempt) => ({
        correct: attempt.isCorrect,
        responseTimeMs: attempt.responseTimeMs,
        createdAt: attempt.createdAt,
        componentId: attempt.knowledgeComponentId,
        difficulty: attempt.difficulty,
      })),
      { componentId, difficulty: "MEDIUM" },
    );
    const resolvedEstimate = {
      ...estimate,
      nextCorrectProbability:
        deep.status === "predicted"
          ? deep.probability
          : estimate.nextCorrectProbability,
      source:
        deep.status === "predicted"
          ? ("DEEP" as const)
          : deep.status === "fallback"
            ? ("BKT_FALLBACK" as const)
            : ("BKT" as const),
      modelVersion:
        deep.status === "predicted" ? deep.modelVersion : BKT_MODEL_VERSION,
    };
    const state = await prisma.studentConceptMastery.upsert({
      where: {
        userId_knowledgeComponentId: {
          userId: input.userId,
          knowledgeComponentId: componentId,
        },
      },
      create: {
        userId: input.userId,
        knowledgeComponentId: componentId,
        ...resolvedEstimate,
      },
      update: {
        ...resolvedEstimate,
      },
    });

    if (input.quizCompletionId) {
      await prisma.masterySnapshot.upsert({
        where: {
          quizCompletionId_knowledgeComponentId: {
            quizCompletionId: input.quizCompletionId,
            knowledgeComponentId: componentId,
          },
        },
        create: {
          userId: input.userId,
          knowledgeComponentId: componentId,
          quizCompletionId: input.quizCompletionId,
          ...resolvedEstimate,
        },
        update: {
          ...resolvedEstimate,
        },
      });
    }
    results.push(state);
  }
  return results;
}

export async function recomputeAllMastery(userId: string) {
  const components = await prisma.knowledgeComponent.findMany({
    where: { userId },
    select: { id: true },
  });
  return recomputeMasteryForComponents({
    userId,
    componentIds: components.map((component) => component.id),
  });
}

export async function getMasteryOverview(
  userId: string,
): Promise<MasteryOverview> {
  const [components, snapshots] = await Promise.all([
    prisma.knowledgeComponent.findMany({
      where: { userId, status: "CONFIRMED", topic: { archivedAt: null } },
      include: {
        topic: { include: { subject: true } },
        mastery: { where: { userId }, take: 1 },
        materials: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { material: { select: { id: true, title: true } } },
        },
      },
      orderBy: [
        { topic: { subject: { name: "asc" } } },
        { topic: { name: "asc" } },
        { name: "asc" },
      ],
    }),
    prisma.masterySnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const summaries: MasterySummary[] = components.map((component) => {
    const state = component.mastery[0];
    return {
      componentId: component.id,
      componentName: component.name,
      topicId: component.topic.id,
      topicName: component.topic.name,
      subjectId: component.topic.subject.id,
      subjectName: component.topic.subject.name,
      subjectColor: component.topic.subject.color,
      masteryProbability: state?.masteryProbability ?? null,
      nextCorrectProbability: state?.nextCorrectProbability ?? null,
      evidenceCount: state?.evidenceCount ?? 0,
      source: state?.source ?? null,
      updatedAt: state?.updatedAt.toISOString() ?? null,
      materialId: component.materials[0]?.material.id ?? null,
      materialTitle: component.materials[0]?.material.title ?? null,
    };
  });

  const { recommendation, recommendationReason } =
    chooseMasteryRecommendation(summaries);

  return {
    components: summaries,
    trends: snapshots.reverse().map((snapshot) => ({
      componentId: snapshot.knowledgeComponentId,
      masteryProbability: snapshot.masteryProbability,
      nextCorrectProbability: snapshot.nextCorrectProbability,
      evidenceCount: snapshot.evidenceCount,
      source: snapshot.source,
      createdAt: snapshot.createdAt.toISOString(),
    })),
    recommendation,
    recommendationReason,
  };
}
