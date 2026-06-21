import { describe, it, expect } from "vitest";
import {
  computeSessionQuality,
  type SessionQualityInput,
} from "./session-quality";

const base: SessionQualityInput = {
  creditedDurationSec: 0,
  targetDurationSec: 1800,
  explicitStop: false,
  goalCompleted: false,
  autoClosed: false,
  summariesViewed: 0,
  tutorQuestions: 0,
  quizAttempts: 0,
  explanationsReviewed: 0,
};

describe("computeSessionQuality", () => {
  it("is 0 for an empty session", () => {
    expect(computeSessionQuality(base).total).toBe(0);
  });

  it("awards full duration adherence when target met", () => {
    const r = computeSessionQuality({ ...base, creditedDurationSec: 1800 });
    expect(r.durationAdherence).toBe(40);
  });

  it("caps duration adherence at 40 even when over target", () => {
    const r = computeSessionQuality({ ...base, creditedDurationSec: 9999 });
    expect(r.durationAdherence).toBe(40);
  });

  it("scales duration adherence proportionally", () => {
    const r = computeSessionQuality({ ...base, creditedDurationSec: 900 });
    expect(r.durationAdherence).toBe(20);
  });

  it("awards stop + goal points only when not auto-closed", () => {
    const open = computeSessionQuality({
      ...base,
      explicitStop: true,
      goalCompleted: true,
    });
    expect(open.explicitStop).toBe(15);
    expect(open.goalCompletion).toBe(15);

    const auto = computeSessionQuality({
      ...base,
      explicitStop: true,
      goalCompleted: true,
      autoClosed: true,
    });
    expect(auto.explicitStop).toBe(0);
    expect(auto.goalCompletion).toBe(0);
  });

  it("bounds engagement to 30 with per-category caps", () => {
    const r = computeSessionQuality({
      ...base,
      summariesViewed: 50,
      tutorQuestions: 50,
      quizAttempts: 50,
      explanationsReviewed: 50,
    });
    expect(r.engagement).toBe(30);
  });

  it("never exceeds 100 and never goes below 0", () => {
    const max = computeSessionQuality({
      creditedDurationSec: 5000,
      targetDurationSec: 1800,
      explicitStop: true,
      goalCompleted: true,
      autoClosed: false,
      summariesViewed: 99,
      tutorQuestions: 99,
      quizAttempts: 99,
      explanationsReviewed: 99,
    });
    expect(max.total).toBe(100);

    const neg = computeSessionQuality({
      ...base,
      creditedDurationSec: -100,
      targetDurationSec: -5,
    });
    expect(neg.total).toBe(0);
  });
});
