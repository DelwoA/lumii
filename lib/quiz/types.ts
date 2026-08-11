// =============================================================================
// FILE: lib/quiz/types.ts
// WHAT THIS FILE DOES:
//   The shared "shapes" for the quiz feature: a question as shown to the student
//   (note: no correct answer included), a graded question shown after submitting,
//   and the results of starting and submitting a quiz. Keeping these shapes in
//   their own file lets the browser quiz screen and the server agree on them.
// =============================================================================
/** Shared quiz types (kept out of the "use server" action file). */
import type { Celebration } from "@/lib/gamification/celebration";
import type { MasterySummary } from "@/lib/mastery/types";

export type QuizMode = "QUICK" | "STANDARD";
export type QuizDifficulty = "EASY" | "MEDIUM" | "HARD";

/** A question as sent to the client (no answer key). */
export type QuizQuestionPublic = {
  id: number;
  question: string;
  options: string[];
  componentId: string;
  componentName: string;
  difficulty: QuizDifficulty;
};

/** A graded question returned after submission, for display + PDF export. */
export type GradedQuestion = {
  id: number;
  question: string;
  options: string[];
  chosen: number | null;
  correctAnswer: number;
  explanation: string | null;
  componentId: string;
  componentName: string;
  difficulty: QuizDifficulty;
};

export type StartQuizResult =
  | { ok: true; token: string; questions: QuizQuestionPublic[] }
  | { ok: false; error: string };

export type SubmitQuizResult =
  | {
      ok: true;
      correctCount: number;
      questionCount: number;
      graded: GradedQuestion[];
      xpAwarded: number;
      masteryUpdates: MasterySummary[];
      celebration?: Celebration;
    }
  | { ok: false; error: string };
