import { describe, it, expect } from "vitest";
import { quizXp, sessionXp, applyDailyCap, XP_RULES } from "./xp";

describe("quizXp", () => {
  it("is base + per-correct", () => {
    expect(quizXp(0, 5)).toBe(XP_RULES.QUIZ_COMPLETED_BASE);
    expect(quizXp(3, 5)).toBe(10 + 3 * 4);
  });
  it("caps at QUIZ_MAX", () => {
    expect(quizXp(100, 100)).toBe(XP_RULES.QUIZ_MAX);
  });
  it("never credits more correct than total", () => {
    expect(quizXp(9, 5)).toBe(quizXp(5, 5));
  });
});

describe("sessionXp", () => {
  it("is base with zero quality", () => {
    expect(sessionXp(0)).toBe(XP_RULES.SESSION_COMPLETED_BASE);
  });
  it("adds the full bonus at quality 100", () => {
    expect(sessionXp(100)).toBe(
      XP_RULES.SESSION_COMPLETED_BASE + XP_RULES.SESSION_QUALITY_BONUS_MAX,
    );
  });
  it("scales the bonus", () => {
    expect(sessionXp(50)).toBe(XP_RULES.SESSION_COMPLETED_BASE + 10);
  });
});

describe("applyDailyCap", () => {
  it("grants the full delta under the cap", () => {
    expect(applyDailyCap(0, 30)).toBe(30);
  });
  it("clamps to the remaining cap", () => {
    expect(applyDailyCap(190, 30)).toBe(10);
  });
  it("grants nothing once capped", () => {
    expect(applyDailyCap(XP_RULES.DAILY_CAP, 30)).toBe(0);
  });
});
