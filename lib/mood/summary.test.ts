import { describe, it, expect } from "vitest";
import { buildMoodSummary, MOOD_WINDOW_DAYS } from "./summary";

describe("buildMoodSummary", () => {
  it("returns null when there is nothing in the window", () => {
    expect(buildMoodSummary({ pos: 0, neu: 0, neg: 0 })).toBeNull();
  });

  it("reports a positive headline when positive strictly dominates", () => {
    const s = buildMoodSummary({ pos: 3, neu: 1, neg: 1 });
    expect(s).toEqual({
      headline: "Mostly positive lately",
      pos: 3,
      neu: 1,
      neg: 1,
      total: 5,
    });
  });

  it("reports a tough stretch when negative strictly dominates", () => {
    const s = buildMoodSummary({ pos: 1, neu: 2, neg: 4 });
    expect(s?.headline).toBe("A tough stretch lately");
    expect(s?.total).toBe(7);
  });

  it("reports a balanced mix when neutral leads", () => {
    expect(buildMoodSummary({ pos: 1, neu: 3, neg: 1 })?.headline).toBe(
      "A balanced mix lately",
    );
  });

  it("treats a positive/negative tie as a balanced mix (neither strictly wins)", () => {
    expect(buildMoodSummary({ pos: 2, neu: 0, neg: 2 })?.headline).toBe(
      "A balanced mix lately",
    );
  });

  it("treats a single check-in as that direction", () => {
    expect(buildMoodSummary({ pos: 1, neu: 0, neg: 0 })?.headline).toBe(
      "Mostly positive lately",
    );
    expect(buildMoodSummary({ pos: 0, neu: 0, neg: 1 })?.headline).toBe(
      "A tough stretch lately",
    );
  });

  it("exposes a 14-day window", () => {
    expect(MOOD_WINDOW_DAYS).toBe(14);
  });
});
