import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { predictNextCorrect } from "./inference";

const attempts = [
  {
    correct: true,
    responseTimeMs: 1_200,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    componentId: "component-1",
    difficulty: "MEDIUM" as const,
  },
  {
    correct: false,
    responseTimeMs: 1_800,
    createdAt: new Date("2026-08-01T00:05:00Z"),
    componentId: "component-1",
    difficulty: "HARD" as const,
  },
  {
    correct: true,
    responseTimeMs: 900,
    createdAt: new Date("2026-08-01T00:10:00Z"),
    componentId: "component-1",
    difficulty: "EASY" as const,
  },
];

afterEach(() => {
  delete process.env.MASTERY_DEEP_MODEL_ENABLED;
});

describe("predictNextCorrect", () => {
  it("uses the disabled path before loading native inference", async () => {
    process.env.MASTERY_DEEP_MODEL_ENABLED = "false";

    await expect(predictNextCorrect(attempts)).resolves.toEqual({
      status: "disabled",
      reason: "Deep inference feature flag is off",
    });
  });

  it("uses the cold-start path when evidence is insufficient", async () => {
    process.env.MASTERY_DEEP_MODEL_ENABLED = "true";

    await expect(predictNextCorrect(attempts.slice(0, 2))).resolves.toEqual({
      status: "cold_start",
      reason: "At least three responses are required",
    });
  });

  it("rejects the bundled model when its promotion gates failed", async () => {
    process.env.MASTERY_DEEP_MODEL_ENABLED = "true";

    await expect(predictNextCorrect(attempts)).resolves.toEqual({
      status: "disabled",
      reason: "The model did not pass promotion gates",
    });
  });
});
