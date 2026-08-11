import { requireDbUser } from "@/lib/auth";
import { getQuizHistory } from "@/lib/quiz/history";
import { QuizHistory } from "@/components/progress/quiz-history";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuizHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireDbUser();
  const query = await searchParams;
  const mode = first(query.mode);
  const result = first(query.result);
  const history = await getQuizHistory(user.id, {
    page: Math.max(1, Number.parseInt(first(query.page) || "1", 10) || 1),
    subjectId: first(query.subject) || undefined,
    topicId: first(query.topic) || undefined,
    mode: mode === "QUICK" || mode === "STANDARD" ? mode : undefined,
    result:
      result === "perfect" || result === "passed" || result === "needs-practice"
        ? result
        : undefined,
    selectedId: first(query.attempt) || undefined,
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
            Your private record
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Quiz history
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Revisit every question, answer, and explanation used in your mastery
            map.
          </p>
        </div>
      </header>

      <form className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <select
          name="subject"
          defaultValue={first(query.subject) || ""}
          className="border-input bg-card h-9 rounded-lg border px-3 text-sm"
        >
          <option value="">All subjects</option>
          {history.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <select
          name="topic"
          defaultValue={first(query.topic) || ""}
          className="border-input bg-card h-9 rounded-lg border px-3 text-sm"
        >
          <option value="">All topics</option>
          {history.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
        <select
          name="mode"
          defaultValue={mode || ""}
          className="border-input bg-card h-9 rounded-lg border px-3 text-sm"
        >
          <option value="">Any length</option>
          <option value="QUICK">Quick 5</option>
          <option value="STANDARD">Standard 10</option>
        </select>
        <select
          name="result"
          defaultValue={result || ""}
          className="border-input bg-card h-9 rounded-lg border px-3 text-sm"
        >
          <option value="">Any result</option>
          <option value="perfect">Perfect</option>
          <option value="passed">60% or higher</option>
          <option value="needs-practice">Below 60%</option>
        </select>
        <Button type="submit" size="sm">
          Apply filters
        </Button>
      </form>

      <QuizHistory
        entries={history.entries}
        selected={history.selected}
        page={history.page}
        total={history.total}
        totalPages={history.totalPages}
      />
    </main>
  );
}
