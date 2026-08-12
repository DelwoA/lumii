import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuizRunner } from "./quiz-runner";

const quizActions = vi.hoisted(() => ({
  startQuiz: vi.fn(),
  submitQuiz: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/materials/quiz-actions", () => quizActions);

describe("QuizRunner automatic handoff", () => {
  beforeEach(() => {
    quizActions.startQuiz.mockReset();
    quizActions.submitQuiz.mockReset();
  });

  it("starts a Quick Quiz when confirmed concepts arrive", async () => {
    quizActions.startQuiz.mockResolvedValue({
      ok: true,
      token: "quiz-token",
      questions: [
        {
          id: 0,
          question: "Which quantity is impulse equal to?",
          options: ["Change in momentum", "Mass", "Velocity", "Power"],
          componentId: "concept-1",
          componentName: "Impulse",
          difficulty: "MEDIUM",
        },
      ],
    });

    render(
      <QuizRunner
        materialId="material-1"
        materialTitle="Momentum notes"
        concepts={[
          {
            id: "concept-1",
            name: "Impulse",
            description: "Relate force, time, and momentum change.",
            status: "CONFIRMED",
            evidence: [],
          },
        ]}
        autoStartKey={1}
      />,
    );

    await waitFor(() =>
      expect(quizActions.startQuiz).toHaveBeenCalledWith({
        materialId: "material-1",
        mode: "QUICK",
        componentId: undefined,
      }),
    );
    expect(
      await screen.findByText("Which quantity is impulse equal to?", {
        exact: false,
      }),
    ).toBeVisible();
  });
});
