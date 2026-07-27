import { describe, expect, it } from "vitest";
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
  activity: {
    summariesGenerated: 0,
    tutorQuestions: 0,
    quizzesCompleted: 0,
  },
};

describe("Session Quality v2", () => {
  it("scales duration to 50 points and caps over-target time", () => {
    expect(
      computeSessionQuality({ ...base, creditedDurationSec: 900 })
        .durationAdherence,
    ).toBe(25);
    expect(
      computeSessionQuality({ ...base, creditedDurationSec: 9999 })
        .durationAdherence,
    ).toBe(50);
  });

  it("awards follow-through only for an intentional close", () => {
    const intentional = computeSessionQuality({
      ...base,
      explicitStop: true,
      goalCompleted: true,
    });
    expect(intentional.intentionalStop).toBe(10);
    expect(intentional.goalCompletion).toBe(20);

    const automatic = computeSessionQuality({
      ...base,
      explicitStop: true,
      goalCompleted: true,
      autoClosed: true,
    });
    expect(automatic.intentionalStop).toBe(0);
    expect(automatic.goalCompletion).toBe(0);
  });

  it("credits only bounded, verified activity", () => {
    const result = computeSessionQuality({
      ...base,
      activity: {
        summariesGenerated: 20,
        tutorQuestions: 20,
        quizzesCompleted: 20,
      },
    });
    expect(result.learningActivity).toBe(20);
    expect(result.activity).toEqual({
      summariesGenerated: 20,
      tutorQuestions: 20,
      quizzesCompleted: 20,
    });
  });

  it("reaches exactly 100 for complete follow-through", () => {
    expect(
      computeSessionQuality({
        ...base,
        creditedDurationSec: 1800,
        explicitStop: true,
        goalCompleted: true,
        activity: {
          summariesGenerated: 1,
          tutorQuestions: 3,
          quizzesCompleted: 1,
        },
      }).total,
    ).toBe(100);
  });

  it("normalizes invalid negative inputs", () => {
    expect(
      computeSessionQuality({
        ...base,
        creditedDurationSec: -10,
        targetDurationSec: -1,
        activity: {
          summariesGenerated: -1,
          tutorQuestions: Number.NaN,
          quizzesCompleted: -4,
        },
      }).total,
    ).toBe(0);
  });
});
