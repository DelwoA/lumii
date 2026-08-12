"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Clock3, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  clearQuizHistory,
  deleteQuizAttempt,
} from "@/app/(app)/progress/actions";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  materialTitle: string;
  subjectName: string | null;
  topicName: string | null;
  questionCount: number;
  correctCount: number;
  durationSec: number;
  mode: "QUICK" | "STANDARD";
  completedAt: string;
  hasDetails: boolean;
};

type Selected = {
  id: string;
  materialTitle: string;
  questionCount: number;
  correctCount: number;
  durationSec: number;
  mode: "QUICK" | "STANDARD";
  completedAt: string;
  questions: Array<{
    id: string;
    componentName: string | null;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    question: string;
    options: string[];
    chosenOption: number | null;
    correctOption: number;
    isCorrect: boolean;
    explanation: string | null;
    responseTimeMs: number | null;
  }>;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function QuizHistory({
  entries,
  selected,
  page,
  total,
  totalPages,
}: {
  entries: Entry[];
  selected: Selected | null;
  page: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function removeOne(id: string) {
    startTransition(async () => {
      const result = await deleteQuizAttempt(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Quiz deleted and mastery recalculated");
      router.push("/progress/quizzes");
      router.refresh();
    });
  }

  function clearAll() {
    startTransition(async () => {
      await clearQuizHistory();
      toast.success("Quiz history cleared");
      router.push("/progress/quizzes");
      router.refresh();
    });
  }

  if (!entries.length) {
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center">
        <CheckCircle2 className="text-primary size-8" />
        <h2 className="font-medium">No quizzes match these filters</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Complete a concept-aligned quiz from a material, or reset the filters
          to see earlier attempts.
        </p>
        <Button nativeButton={false} render={<Link href="/library/new" />}>
          Add Material
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {total} saved attempts
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive gap-2"
                >
                  <Trash2 className="size-4" />
                  Clear all
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all quiz history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes every saved quiz and recalculates
                  your mastery map from no quiz evidence.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll} disabled={pending}>
                  Clear history
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {entries.map((entry) => {
          const active = entry.id === selected?.id;
          return (
            <Link
              key={entry.id}
              href={`/progress/quizzes?attempt=${entry.id}`}
              className={cn(
                "bg-card block rounded-xl border p-4 transition-shadow hover:shadow-sm focus-visible:ring-3 focus-visible:outline-none",
                active && "ring-primary/40 ring-2",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {entry.materialTitle}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {[entry.subjectName, entry.topicName]
                      .filter(Boolean)
                      .join(" / ") || "Uncategorised"}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {entry.correctCount}/{entry.questionCount}
                </span>
              </div>
              <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                <span>{new Date(entry.completedAt).toLocaleDateString()}</span>
                <Badge variant="secondary">
                  {entry.mode === "STANDARD" ? "Standard 10" : "Quick 5"}
                </Badge>
              </div>
            </Link>
          );
        })}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              render={
                page > 1 ? (
                  <Link href={`/progress/quizzes?page=${page - 1}`} />
                ) : undefined
              }
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-xs">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              render={
                page < totalPages ? (
                  <Link href={`/progress/quizzes?page=${page + 1}`} />
                ) : undefined
              }
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <Card className="overflow-hidden p-0">
          <div className="bg-secondary/35 flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                Saved quiz
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {selected.materialTitle}
              </h2>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>{new Date(selected.completedAt).toLocaleString()}</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  {formatDuration(selected.durationSec)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {selected.correctCount}/{selected.questionCount}
              </span>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete this quiz"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its question history will be removed and affected mastery
                      estimates will be recalculated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeOne(selected.id)}
                      disabled={pending}
                    >
                      Delete quiz
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {selected.questions.length ? (
            <div className="divide-y">
              {selected.questions.map((question, index) => (
                <article key={question.id} className="p-5">
                  <div className="flex items-start gap-2">
                    {question.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-red-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">
                        {index + 1}. {question.question}
                      </h3>
                      {question.componentName ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-primary text-xs font-medium">
                            {question.componentName}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {question.difficulty.toLowerCase()}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 pl-7">
                    {question.options.map((option, optionIndex) => (
                      <p
                        key={optionIndex}
                        className={cn(
                          "rounded-md px-2 py-1 text-sm",
                          optionIndex === question.correctOption &&
                            "bg-green-700/10 font-medium text-green-800",
                          optionIndex === question.chosenOption &&
                            optionIndex !== question.correctOption &&
                            "bg-red-700/10 text-red-800",
                        )}
                      >
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </p>
                    ))}
                    {question.explanation ? (
                      <p className="text-muted-foreground mt-3 border-t pt-2 text-sm">
                        <span className="font-medium">Why:</span>{" "}
                        {question.explanation}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="font-medium">Summary-only legacy attempt</p>
              <p className="text-muted-foreground mt-1 text-sm">
                This quiz was completed before question history was introduced,
                so its individual answers are unavailable.
              </p>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
