import { describe, expect, it } from "vitest";
import {
  buildMasteryFeatures,
  buildTransferMasteryFeatures,
  MASTERY_FEATURE_COUNT,
  TRANSFER_MASTERY_FEATURE_COUNT,
} from "@/lib/mastery/features";

describe("buildMasteryFeatures", () => {
  it("right-pads a bounded sequence and calculates running accuracy", () => {
    const result = buildMasteryFeatures(
      [
        {
          correct: true,
          responseTimeMs: 10_000,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          correct: false,
          responseTimeMs: 20_000,
          createdAt: new Date("2026-01-02T00:00:00Z"),
        },
      ],
      4,
    );
    expect(result.length).toBe(2);
    expect(result.values).toHaveLength(4 * MASTERY_FEATURE_COUNT);
    expect(result.values[4]).toBe(1);
    expect(result.values[MASTERY_FEATURE_COUNT + 4]).toBe(0.5);
    expect(result.values.slice(2 * MASTERY_FEATURE_COUNT)).toEqual(
      new Float32Array(10),
    );
  });

  it("builds the portable transfer schema from global and target-concept history", () => {
    const result = buildTransferMasteryFeatures(
      [
        {
          correct: true,
          responseTimeMs: 10_000,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          componentId: "algebra",
          difficulty: "EASY",
        },
        {
          correct: false,
          responseTimeMs: 20_000,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          componentId: "geometry",
          difficulty: "HARD",
        },
        {
          correct: true,
          responseTimeMs: 15_000,
          createdAt: new Date("2026-01-03T00:00:00Z"),
          componentId: "algebra",
          difficulty: "MEDIUM",
        },
      ],
      { componentId: "algebra", difficulty: "MEDIUM", globalProbability: 0.6 },
      5,
    );
    expect(result.length).toBe(3);
    expect(result.values).toHaveLength(5 * TRANSFER_MASTERY_FEATURE_COUNT);
    expect(result.values[8]).toBe(1);
    expect(result.values[9]).toBe(0.5);
    expect(result.values[12]).toBeGreaterThan(0);
    expect(result.values.slice(3 * TRANSFER_MASTERY_FEATURE_COUNT)).toEqual(
      new Float32Array(2 * TRANSFER_MASTERY_FEATURE_COUNT),
    );
  });
});
