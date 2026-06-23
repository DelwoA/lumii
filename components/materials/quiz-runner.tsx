"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { startQuiz, submitQuiz } from "@/app/(app)/materials/quiz-actions";
import type { QuizQuestionPublic, GradedQuestion } from "@/lib/quiz/types";
import { useCelebrationStore } from "@/lib/stores/celebration-store";

type Phase = "idle" | "generating" | "taking" | "submitting" | "result";
type Result = {
  correctCount: number;
  questionCount: number;
  graded: GradedQuestion[];
  xpAwarded: number;
};

export function QuizRunner({
  materialId,
  materialTitle,
}: {
  materialId: string;
  materialTitle: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(0);
  const celebrate = useCelebrationStore((s) => s.celebrate);

  // Ephemeral result: warn before a tab close/refresh while it is on screen.
  useEffect(() => {
    if (phase !== "result") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  async function onGenerate() {
    setPhase("generating");
    setResult(null);
    setAnswers({});
    const res = await startQuiz(materialId);
    if (!res.ok) {
      toast.error(res.error);
      setPhase(result ? "result" : "idle");
      return;
    }
    setToken(res.token);
    setQuestions(res.questions);
    startedAt.current = Date.now();
    setPhase("taking");
  }

  const allAnswered =
    questions.length > 0 && questions.every((q) => answers[q.id] != null);

  async function onSubmit() {
    if (!token) return;
    setPhase("submitting");
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const res = await submitQuiz({
      materialId,
      token,
      questions,
      answers: questions.map((q) => answers[q.id] ?? null),
      durationSec,
    });
    if (!res.ok) {
      toast.error(res.error);
      setPhase("taking");
      return;
    }
    setResult({
      correctCount: res.correctCount,
      questionCount: res.questionCount,
      graded: res.graded,
      xpAwarded: res.xpAwarded,
    });
    setPhase("result");
    if (res.xpAwarded > 0) toast.success(`Quiz complete. +${res.xpAwarded} XP`);
    celebrate(res.celebration);
  }

  async function onExportPdf() {
    if (!result) return;
    try {
      const [{ pdf }, { QuizResultPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/quiz-result-pdf"),
      ]);
      const blob = await pdf(
        <QuizResultPdf
          title={materialTitle}
          correctCount={result.correctCount}
          questionCount={result.questionCount}
          graded={result.graded}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumii-quiz-result.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not export the PDF");
    }
  }

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Sparkles className="text-primary size-8" />
        <p className="text-muted-foreground max-w-sm text-sm">
          Generate a 5-question multiple-choice quiz from this material. Results
          are shown once and not saved, so export the PDF if you want a copy.
        </p>
        <Button onClick={onGenerate} className="gap-2">
          <Sparkles className="size-4" />
          Generate quiz
        </Button>
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (phase === "taking" || phase === "submitting") {
    return (
      <div className="space-y-5">
        {questions.map((q, idx) => (
          <Card key={q.id} className="p-4">
            <p className="mb-3 font-medium">
              {idx + 1}. {q.question}
            </p>
            <RadioGroup
              value={answers[q.id]?.toString()}
              onValueChange={(v) =>
                setAnswers((a) => ({ ...a, [q.id]: Number(v) }))
              }
              disabled={phase === "submitting"}
              className="gap-2"
            >
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <RadioGroupItem value={oi.toString()} id={`q${q.id}-o${oi}`} />
                  <Label htmlFor={`q${q.id}-o${oi}`} className="cursor-pointer font-normal">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </Card>
        ))}
        <Button onClick={onSubmit} disabled={!allAnswered || phase === "submitting"}>
          {phase === "submitting" ? "Marking…" : "Submit quiz"}
        </Button>
      </div>
    );
  }

  // result
  return (
    <div className="space-y-5">
      <Card className="bg-primary text-primary-foreground flex items-center justify-between p-4">
        <span className="text-lg font-semibold">
          Score: {result!.correctCount} / {result!.questionCount}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={onExportPdf}
          >
            <Download className="size-4" />
            Export PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button size="sm" variant="secondary" className="gap-2">
                  <RefreshCw className="size-4" />
                  New quiz
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new quiz?</AlertDialogTitle>
                <AlertDialogDescription>
                  This result will be cleared and is not saved. Export the PDF
                  first if you want to keep it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onGenerate}>
                  New quiz
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      {result!.graded.map((q, idx) => {
        const correct = q.chosen === q.correctAnswer;
        return (
          <Card key={q.id} className="p-4">
            <div className="mb-3 flex items-start gap-2">
              {correct ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
              )}
              <p className="font-medium">
                {idx + 1}. {q.question}
              </p>
            </div>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.correctAnswer;
                const isChosen = oi === q.chosen;
                return (
                  <p
                    key={oi}
                    className={cn(
                      "rounded-md px-2 py-1 text-sm",
                      isCorrect && "bg-green-600/10 font-medium text-green-700 dark:text-green-400",
                      isChosen && !isCorrect && "bg-red-600/10 text-red-700 dark:text-red-400",
                    )}
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                  </p>
                );
              })}
            </div>
            {q.explanation ? (
              <p className="text-muted-foreground mt-3 border-t pt-2 text-sm">
                <span className="font-medium">Why:</span> {q.explanation}
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
