import { describe, expect, it } from "vitest";
import { estimateBkt, probabilityCorrect, updateBkt } from "./bkt";

describe("Bayesian Knowledge Tracing", () => {
  it("raises mastery after a correct response", () => {
    expect(updateBkt(0.2, true)).toBeGreaterThan(0.2);
  });

  it("lowers the estimate after evidence of an error", () => {
    expect(updateBkt(0.8, false)).toBeLessThan(0.8);
  });

  it("returns bounded, deterministic estimates", () => {
    const result = estimateBkt([true, true, false, true]);
    expect(result.evidenceCount).toBe(4);
    expect(result.masteryProbability).toBeGreaterThanOrEqual(0);
    expect(result.masteryProbability).toBeLessThanOrEqual(1);
    expect(result.nextCorrectProbability).toBe(
      probabilityCorrect(result.masteryProbability),
    );
  });
});
