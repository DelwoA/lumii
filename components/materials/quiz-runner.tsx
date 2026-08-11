"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Download,
  RefreshCw,
  Sparkles,
  XCircle,
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
import type {
  GradedQuestion,
  QuizMode,
  QuizQuestionPublic,
} from "@/lib/quiz/types";
import type { MasterySummary } from "@/lib/mastery/types";
import type { MaterialConcept } from "@/components/materials/concept-setup";
import { useCelebrationStore } from "@/lib/stores/celebration-store";

type Phase = "idle" | "generating" | "taking" | "submitting" | "result";
type Result = {
  correctCount: number;
  questionCount: number;
  graded: GradedQuestion[];
  xpAwarded: number;
  masteryUpdates: MasterySummary[];
};

export function QuizRunner({
  materialId,
  materialTitle,
  concepts,
  initialFocusComponentId,
}: {
  materialId: string;
  materialTitle: string;
  concepts: MaterialConcept[];
  initialFocusComponentId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [focusComponentId, setFocusComponentId] = useState(() =>
    initialFocusComponentId &&
    concepts.some((concept) => concept.id === initialFocusComponentId)
      ? initialFocusComponentId
      : "mixed",
  );
  const startedAt = useRef(0);
  const responseTimes = useRef<Record<number, number>>({});
  const celebrate = useCelebrationStore((state) => state.celebrate);

  useEffect(() => {
    if (phase !== "taking" && phase !== "submitting") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  async function onGenerate(mode: QuizMode = "QUICK") {
    setPhase("generating");
    setResult(null);
    setAnswers({});
    responseTimes.current = {};
    const response = await startQuiz({
      materialId,
      mode,
      componentId: focusComponentId === "mixed" ? undefined : focusComponentId,
    });
    if (!response.ok) {
      toast.error(response.error);
      setPhase(result ? "result" : "idle");
      return;
    }
    setToken(response.token);
    setQuestions(response.questions);
    startedAt.current = Date.now();
    setPhase("taking");
  }

  const allAnswered =
    questions.length > 0 &&
    questions.every((question) => answers[question.id] != null);

  async function onSubmit() {
    if (!token) return;
    setPhase("submitting");
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const response = await submitQuiz({
      materialId,
      token,
      answers: questions.map((question) => answers[question.id] ?? null),
      responseTimesMs: questions.map(
        (question) => responseTimes.current[question.id] ?? null,
      ),
      durationSec,
    });
    if (!response.ok) {
      toast.error(response.error);
      setPhase("taking");
      return;
    }
    setResult({
      correctCount: response.correctCount,
      questionCount: response.questionCount,
      graded: response.graded,
      xpAwarded: response.xpAwarded,
      masteryUpdates: response.masteryUpdates,
    });
    setPhase("result");
    if (response.xpAwarded > 0) {
      toast.success(`Quiz complete. +${response.xpAwarded} XP`);
    }
    celebrate(response.celebration);
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
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "lumii-quiz-result.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not export the PDF");
    }
  }

  if (phase === "idle") {
    if (concepts.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <BrainCircuit className="text-primary size-8" />
          <p className="text-muted-foreground max-w-sm text-sm">
            Confirm the concept map above before generating a mastery-tracked
            quiz.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Sparkles className="text-primary size-8" />
        <p className="text-muted-foreground max-w-md text-sm">
          Generate a concept-aligned practice quiz. Questions, answers,
          explanations, and mastery updates are saved privately in Progress.
        </p>
        <div className="w-full max-w-sm text-left">
          <Label htmlFor="quiz-focus" className="text-xs">
            Practice focus
          </Label>
          <select
            id="quiz-focus"
            value={focusComponentId}
            onChange={(event) => setFocusComponentId(event.target.value)}
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 mt-1.5 h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
          >
            <option value="mixed">Mixed concepts</option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => onGenerate("STANDARD")} className="gap-2">
            <Sparkles className="size-4" />
            Standard 10
          </Button>
          <Button
            onClick={() => onGenerate("QUICK")}
            variant="outline"
            className="gap-2"
          >
            <Clock3 className="size-4" />
            Quick 5
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-2">
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
        {questions.map((question, index) => (
          <Card key={question.id} className="p-4">
            <p className="font-medium">
              {index + 1}. {question.question}
            </p>
            <p className="text-primary mt-1 mb-3 text-xs font-medium">
              {question.componentName} · {question.difficulty.toLowerCase()}
            </p>
            <RadioGroup
              value={answers[question.id]?.toString()}
              onValueChange={(value) => {
                if (responseTimes.current[question.id] == null) {
                  responseTimes.current[question.id] =
                    Date.now() - startedAt.current;
                }
                setAnswers((current) => ({
                  ...current,
                  [question.id]: Number(value),
                }));
              }}
              disabled={phase === "submitting"}
              className="gap-2"
            >
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={optionIndex.toString()}
                    id={`q${question.id}-o${optionIndex}`}
                  />
                  <Label
                    htmlFor={`q${question.id}-o${optionIndex}`}
                    className="cursor-pointer font-normal"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </Card>
        ))}
        <Button
          onClick={onSubmit}
          disabled={!allAnswered || phase === "submitting"}
        >
          {phase === "submitting" ? "Marking…" : "Submit quiz"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="bg-primary text-primary-foreground flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-lg font-semibold">
          Score: {result!.correctCount} / {result!.questionCount}
        </span>
        <div className="flex flex-wrap gap-2">
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
                  This result is already saved in Quiz history. Starting again
                  clears only this on-screen view.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onGenerate("QUICK")}>
                  New quiz
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      {result!.masteryUpdates.length ? (
        <Card className="border-primary/20 bg-secondary/35 p-4">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            Mastery updated
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {result!.masteryUpdates.map((mastery) => (
              <div
                key={mastery.componentId}
                className="bg-card flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {mastery.componentName}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {mastery.masteryProbability == null
                    ? "New"
                    : `${Math.round(mastery.masteryProbability * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {result!.graded.map((question, index) => {
        const correct = question.chosen === question.correctAnswer;
        return (
          <Card key={question.id} className="p-4">
            <div className="flex items-start gap-2">
              {correct ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-red-700" />
              )}
              <p className="font-medium">
                {index + 1}. {question.question}
              </p>
            </div>
            <p className="text-primary mt-2 text-xs font-medium">
              {question.componentName} · {question.difficulty.toLowerCase()}
            </p>
            <div className="mt-3 space-y-1.5">
              {question.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === question.correctAnswer;
                const isChosen = optionIndex === question.chosen;
                return (
                  <p
                    key={optionIndex}
                    className={cn(
                      "rounded-md px-2 py-1 text-sm",
                      isCorrect && "bg-green-700/10 font-medium text-green-800",
                      isChosen && !isCorrect && "bg-red-700/10 text-red-800",
                    )}
                  >
                    {String.fromCharCode(65 + optionIndex)}. {option}
                  </p>
                );
              })}
            </div>
            {question.explanation ? (
              <p className="text-muted-foreground mt-3 border-t pt-2 text-sm">
                <span className="font-medium">Why:</span> {question.explanation}
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
