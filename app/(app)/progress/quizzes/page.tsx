import { requireDbUser } from "@/lib/auth";
import { getQuizHistory } from "@/lib/quiz/history";
import { QuizHistory } from "@/components/progress/quiz-history";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const subject = first(query.subject);
  const topic = first(query.topic);
  const history = await getQuizHistory(user.id, {
    page: Math.max(1, Number.parseInt(first(query.page) || "1", 10) || 1),
    subjectId: subject && subject !== "all" ? subject : undefined,
    topicId: topic && topic !== "all" ? topic : undefined,
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
        <div className="space-y-1.5">
          <Label htmlFor="quiz-history-subject">Subject</Label>
          <Select
            name="subject"
            defaultValue={subject || "all"}
            items={Object.fromEntries([
              ["all", "All subjects"],
              ...history.subjects.map((item) => [item.id, item.name]),
            ])}
          >
            <SelectTrigger id="quiz-history-subject" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {history.subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-history-topic">Topic</Label>
          <Select
            name="topic"
            defaultValue={topic || "all"}
            items={Object.fromEntries([
              ["all", "All topics"],
              ...history.topics.map((item) => [item.id, item.name]),
            ])}
          >
            <SelectTrigger id="quiz-history-topic" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {history.topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-history-mode">Quiz length</Label>
          <Select
            name="mode"
            defaultValue={mode || "all"}
            items={{
              all: "Any length",
              QUICK: "Quick 5",
              STANDARD: "Standard 10",
            }}
          >
            <SelectTrigger id="quiz-history-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any length</SelectItem>
              <SelectItem value="QUICK">Quick 5</SelectItem>
              <SelectItem value="STANDARD">Standard 10</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-history-result">Result</Label>
          <Select
            name="result"
            defaultValue={result || "all"}
            items={{
              all: "Any result",
              perfect: "Perfect",
              passed: "60% or higher",
              "needs-practice": "Below 60%",
            }}
          >
            <SelectTrigger id="quiz-history-result" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any result</SelectItem>
              <SelectItem value="perfect">Perfect</SelectItem>
              <SelectItem value="passed">60% or higher</SelectItem>
              <SelectItem value="needs-practice">Below 60%</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
