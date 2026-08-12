import { describe, expect, it } from "vitest";
import { chooseMasteryRecommendation } from "./recommendation";
import type { MasterySummary } from "./types";

function concept(
  id: string,
  overrides: Partial<MasterySummary> = {},
): MasterySummary {
  return {
    componentId: id,
    componentName: `Concept ${id}`,
    topicId: "topic-1",
    topicName: "Mechanics",
    subjectId: "subject-1",
    subjectName: "Physics",
    subjectColor: null,
    masteryProbability: null,
    nextCorrectProbability: null,
    evidenceCount: 0,
    source: null,
    updatedAt: null,
    materialId: `material-${id}`,
    materialTitle: "Physics notes",
    ...overrides,
  };
}

describe("chooseMasteryRecommendation", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");

  it("builds coverage before repeating practised concepts", () => {
    const result = chooseMasteryRecommendation(
      [
        concept("mastered", {
          evidenceCount: 10,
          masteryProbability: 0.2,
          updatedAt: "2026-08-01T12:00:00.000Z",
        }),
        concept("one-answer", {
          evidenceCount: 1,
          updatedAt: "2026-08-12T12:00:00.000Z",
        }),
        concept("new"),
      ],
      now,
    );

    expect(result.recommendation?.componentId).toBe("new");
    expect(result.recommendationReason).toBe("BUILD_COVERAGE");
  });

  it("chooses the weakest concept outside the review cooldown", () => {
    const result = chooseMasteryRecommendation(
      [
        concept("strong", {
          evidenceCount: 5,
          masteryProbability: 0.82,
          updatedAt: "2026-08-10T12:00:00.000Z",
        }),
        concept("weak", {
          evidenceCount: 6,
          masteryProbability: 0.41,
          updatedAt: "2026-08-11T12:00:00.000Z",
        }),
        concept("recent-weaker", {
          evidenceCount: 8,
          masteryProbability: 0.22,
          updatedAt: "2026-08-13T08:00:00.000Z",
        }),
      ],
      now,
    );

    expect(result.recommendation?.componentId).toBe("weak");
    expect(result.recommendationReason).toBe("STRENGTHEN_WEAKNESS");
  });

  it("falls back to the least recently practised concept during cooldown", () => {
    const result = chooseMasteryRecommendation(
      [
        concept("newer", {
          evidenceCount: 3,
          masteryProbability: 0.3,
          updatedAt: "2026-08-13T11:00:00.000Z",
        }),
        concept("older", {
          evidenceCount: 3,
          masteryProbability: 0.8,
          updatedAt: "2026-08-13T02:00:00.000Z",
        }),
      ],
      now,
    );

    expect(result.recommendation?.componentId).toBe("older");
    expect(result.recommendationReason).toBe("SPACED_REVIEW");
  });

  it("ignores concepts without an accessible material", () => {
    const result = chooseMasteryRecommendation(
      [concept("orphan", { materialId: null }), concept("ready")],
      now,
    );

    expect(result.recommendation?.componentId).toBe("ready");
  });
});
