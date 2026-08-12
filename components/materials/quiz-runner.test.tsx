import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("presents Standard first as the primary action and Quick second", async () => {
    quizActions.startQuiz.mockResolvedValue({
      ok: true,
      token: "quiz-token",
      questions: [
        {
          id: 0,
          question: "What is impulse?",
          options: ["Momentum change", "Power", "Mass", "Distance"],
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
      />,
    );

    const standard = screen.getByRole("button", {
      name: "Start Standard Quiz (10)",
    });
    const quick = screen.getByRole("button", {
      name: "Start Quick Quiz (5)",
    });

    expect(
      standard.compareDocumentPosition(quick) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(standard.querySelector(".lucide-sparkles")).not.toBeNull();
    expect(quick.querySelector(".lucide-clock-3")).not.toBeNull();

    fireEvent.click(standard);
    await waitFor(() =>
      expect(quizActions.startQuiz).toHaveBeenCalledWith({
        materialId: "material-1",
        mode: "STANDARD",
        componentId: undefined,
      }),
    );
  });
});
