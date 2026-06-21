/** Shared quiz types (kept out of the "use server" action file). */

/** A question as sent to the client — no answer key. */
export type QuizQuestionPublic = {
  id: number;
  question: string;
  options: string[];
};

/** A graded question returned after submission, for display + PDF export. */
export type GradedQuestion = {
  id: number;
  question: string;
  options: string[];
  chosen: number | null;
  correctAnswer: number;
  explanation: string | null;
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
    }
  | { ok: false; error: string };
