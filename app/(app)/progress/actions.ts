"use server";

import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { getProgressExportSessions } from "@/lib/progress/service";
import type { ProgressFilters } from "@/lib/progress/types";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { recomputeMasteryForComponents } from "@/lib/mastery/service";

const filterSchema = z.object({
  range: z.enum(["30d", "90d", "all", "custom"]),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.number().int().positive(),
  sessionId: z.string().optional(),
});

export async function getProgressExportAction(filters: ProgressFilters) {
  const user = await requireDbUser();
  const parsed = filterSchema.parse(filters);
  const sessions = await getProgressExportSessions(
    user.id,
    parsed,
    user.timezone || "UTC",
  );
  return {
    displayName: user.displayName || "LUMII student",
    timezone: user.timezone || "UTC",
    generatedAtISO: new Date().toISOString(),
    sessions,
  };
}

export async function deleteQuizAttempt(quizCompletionId: string) {
  const user = await requireDbUser();
  const parsedId = z.string().min(1).parse(quizCompletionId);
  const attempt = await prisma.quizCompletion.findFirst({
    where: { id: parsedId, userId: user.id },
    select: {
      questionAttempts: {
        where: { knowledgeComponentId: { not: null } },
        select: { knowledgeComponentId: true },
      },
    },
  });
  if (!attempt) return { ok: false as const, error: "Quiz not found." };
  const componentIds = attempt.questionAttempts.flatMap((question) =>
    question.knowledgeComponentId ? [question.knowledgeComponentId] : [],
  );
  await prisma.quizCompletion.deleteMany({
    where: { id: parsedId, userId: user.id },
  });
  await recomputeMasteryForComponents({
    userId: user.id,
    componentIds,
  });
  revalidatePath("/progress");
  revalidatePath("/progress/mastery");
  revalidatePath("/progress/quizzes");
  return { ok: true as const };
}

export async function clearQuizHistory() {
  const user = await requireDbUser();
  const attempts = await prisma.quizQuestionAttempt.findMany({
    where: { userId: user.id, knowledgeComponentId: { not: null } },
    distinct: ["knowledgeComponentId"],
    select: { knowledgeComponentId: true },
  });
  await prisma.quizCompletion.deleteMany({ where: { userId: user.id } });
  await recomputeMasteryForComponents({
    userId: user.id,
    componentIds: attempts.flatMap((attempt) =>
      attempt.knowledgeComponentId ? [attempt.knowledgeComponentId] : [],
    ),
  });
  revalidatePath("/progress");
  revalidatePath("/progress/mastery");
  revalidatePath("/progress/quizzes");
  return { ok: true as const };
}
