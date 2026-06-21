import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.QUIZ_TOKEN_SECRET = "test-secret-quiz-token-please-change-1234567890";
});

// Import after the secret is set (getKey reads it lazily, so order is flexible).
import {
  encryptQuizToken,
  decryptQuizToken,
  scoreQuiz,
  type QuizAnswerKey,
} from "./token";

const key: QuizAnswerKey = {
  quizInstanceId: "qi_1",
  userId: "user_1",
  materialId: "mat_1",
  questionCount: 3,
  correctAnswers: [0, 2, 1],
  explanations: ["a", null, "c"],
  modelId: "google/gemma-3-27b-it:free",
  generationVersion: "1",
};

describe("quiz token", () => {
  it("round-trips the answer key", async () => {
    const token = await encryptQuizToken(key);
    expect(typeof token).toBe("string");
    const decoded = await decryptQuizToken(token);
    expect(decoded.correctAnswers).toEqual([0, 2, 1]);
    expect(decoded.userId).toBe("user_1");
    expect(decoded.materialId).toBe("mat_1");
    expect(decoded.questionCount).toBe(3);
  });

  it("does not expose answers in plaintext", async () => {
    const token = await encryptQuizToken(key);
    // The correct-answer sequence must not be readable from the token string.
    expect(token).not.toContain("correctAnswers");
  });

  it("rejects a tampered token", async () => {
    const token = await encryptQuizToken(key);
    const tampered = token.slice(0, -3) + "AAA";
    await expect(decryptQuizToken(tampered)).rejects.toBeDefined();
  });
});

describe("scoreQuiz", () => {
  it("counts exact matches only", () => {
    expect(scoreQuiz([0, 2, 1], [0, 2, 1])).toEqual({
      questionCount: 3,
      correctCount: 3,
    });
    expect(scoreQuiz([0, 2, 1], [0, 1, 1])).toEqual({
      questionCount: 3,
      correctCount: 2,
    });
  });
  it("treats null (unanswered) as incorrect", () => {
    expect(scoreQuiz([0, 2, 1], [null, null, 1])).toEqual({
      questionCount: 3,
      correctCount: 1,
    });
  });
});
