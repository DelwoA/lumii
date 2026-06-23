import { describe, it, expect } from "vitest";
import {
  hasCelebration,
  NO_CELEBRATION,
  type UnlockedTrophy,
} from "./celebration";

const trophy: UnlockedTrophy = {
  code: "first-quiz",
  name: "First quiz",
  description: "Completed your first quiz.",
  icon: "trophy",
  xp: 50,
};

describe("hasCelebration", () => {
  it("is false for the empty celebration", () => {
    expect(hasCelebration(NO_CELEBRATION)).toBe(false);
  });
  it("is false for null or undefined", () => {
    expect(hasCelebration(null)).toBe(false);
    expect(hasCelebration(undefined)).toBe(false);
  });
  it("is true when a trophy was unlocked", () => {
    expect(hasCelebration({ trophies: [trophy], rankUp: null })).toBe(true);
  });
  it("is true when the user ranked up", () => {
    expect(hasCelebration({ trophies: [], rankUp: "SILVER" })).toBe(true);
  });
});

describe("NO_CELEBRATION", () => {
  it("carries no awards", () => {
    expect(NO_CELEBRATION.trophies).toEqual([]);
    expect(NO_CELEBRATION.rankUp).toBeNull();
  });
});
