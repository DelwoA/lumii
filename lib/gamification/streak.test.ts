import { describe, it, expect } from "vitest";
import {
  isAdherent,
  isPerfectDay,
  computeAdherenceStreak,
  type PlannedDay,
} from "./streak";

const day = (
  date: string,
  plannedMinutes: number,
  completedMinutes: number,
): PlannedDay => ({ date, plannedMinutes, completedMinutes });

describe("isAdherent", () => {
  it("requires >= 80% of planned minutes", () => {
    expect(isAdherent(day("2026-06-01", 100, 80))).toBe(true);
    expect(isAdherent(day("2026-06-01", 100, 79))).toBe(false);
  });
  it("is false with no plan", () => {
    expect(isAdherent(day("2026-06-01", 0, 0))).toBe(false);
  });
});

describe("isPerfectDay", () => {
  it("requires 100% completion", () => {
    expect(isPerfectDay(day("2026-06-01", 60, 60))).toBe(true);
    expect(isPerfectDay(day("2026-06-01", 60, 59))).toBe(false);
  });
});

describe("computeAdherenceStreak", () => {
  it("counts consecutive adherent planned days", () => {
    const r = computeAdherenceStreak([
      day("2026-06-01", 60, 60),
      day("2026-06-02", 60, 55),
      day("2026-06-03", 60, 48),
    ]);
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.lastAdherentDay).toBe("2026-06-03");
  });

  it("skips no-plan days (neutral) without breaking the run", () => {
    const r = computeAdherenceStreak([
      day("2026-06-01", 60, 60),
      day("2026-06-02", 0, 0), // no plan -> neutral
      day("2026-06-04", 60, 60),
    ]);
    expect(r.current).toBe(2);
  });

  it("breaks the run on a non-adherent planned day", () => {
    const r = computeAdherenceStreak([
      day("2026-06-01", 60, 60),
      day("2026-06-02", 60, 10), // breaks
      day("2026-06-03", 60, 60),
    ]);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(1);
  });

  it("handles unordered input", () => {
    const r = computeAdherenceStreak([
      day("2026-06-03", 60, 60),
      day("2026-06-01", 60, 60),
      day("2026-06-02", 60, 60),
    ]);
    expect(r.current).toBe(3);
  });
});
