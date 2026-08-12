import "server-only";
import { prisma } from "@/lib/prisma";

export type QuizHistoryFilters = {
  page: number;
  subjectId?: string;
  topicId?: string;
  mode?: "QUICK" | "STANDARD";
  result?: "perfect" | "passed" | "needs-practice";
  selectedId?: string;
};

const PAGE_SIZE = 12;

export async function getQuizHistory(
  userId: string,
  filters: QuizHistoryFilters,
) {
  const where = {
    userId,
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.topicId ? { topicId: filters.topicId } : {}),
    ...(filters.mode ? { mode: filters.mode } : {}),
  };

  // Score bands compare two columns, which Prisma's object filters cannot do.
  // Apply those bands after fetching owner-scoped rows; other filters still run
  // in PostgreSQL and the result set is small per student.
  const [allRows, subjects, topics] = await Promise.all([
    prisma.quizCompletion.findMany({
      where,
      include: {
        questionAttempts: {
          select: { id: true },
        },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.topic.findMany({
      where: { userId },
      select: { id: true, name: true, subjectId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const filtered = allRows.filter((row) => {
    if (filters.result === "perfect") {
      return row.correctCount === row.questionCount;
    }
    if (filters.result === "passed") {
      return row.correctCount / row.questionCount >= 0.6;
    }
    if (filters.result === "needs-practice") {
      return row.correctCount / row.questionCount < 0.6;
    }
    return true;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);
  const entries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedId = filters.selectedId ?? entries[0]?.id;
  const selected = selectedId
    ? await prisma.quizCompletion.findFirst({
        where: { id: selectedId, userId },
        include: {
          questionAttempts: { orderBy: { position: "asc" } },
        },
      })
    : null;

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      materialTitle: entry.materialTitle ?? "Deleted material",
      subjectName: entry.subjectName,
      topicName: entry.topicName,
      questionCount: entry.questionCount,
      correctCount: entry.correctCount,
      durationSec: entry.durationSec,
      mode: entry.mode,
      completedAt: entry.completedAt.toISOString(),
      hasDetails: entry.questionAttempts.length > 0,
    })),
    selected: selected
      ? {
          id: selected.id,
          materialTitle: selected.materialTitle ?? "Deleted material",
          questionCount: selected.questionCount,
          correctCount: selected.correctCount,
          durationSec: selected.durationSec,
          mode: selected.mode,
          completedAt: selected.completedAt.toISOString(),
          questions: selected.questionAttempts.map((question) => ({
            id: question.id,
            componentName: question.componentName,
            difficulty: question.difficulty,
            question: question.question,
            options: Array.isArray(question.options)
              ? question.options.filter(
                  (option): option is string => typeof option === "string",
                )
              : [],
            chosenOption: question.chosenOption,
            correctOption: question.correctOption,
            isCorrect: question.isCorrect,
            explanation: question.explanation,
            responseTimeMs: question.responseTimeMs,
          })),
        }
      : null,
    page,
    total,
    totalPages,
    subjects,
    topics,
  };
}
