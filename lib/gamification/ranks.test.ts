import { describe, it, expect } from "vitest";
import { rankForXp, rankProgress, RANK_THRESHOLDS } from "./ranks";

describe("rankForXp", () => {
  it("starts at BRONZE", () => {
    expect(rankForXp(0)).toBe("BRONZE");
    expect(rankForXp(499)).toBe("BRONZE");
  });
  it("crosses tiers at the exact threshold", () => {
    expect(rankForXp(500)).toBe("SILVER");
    expect(rankForXp(1500)).toBe("GOLD");
    expect(rankForXp(3500)).toBe("PLATINUM");
    expect(rankForXp(7000)).toBe("DIAMOND");
  });
  it("caps at DIAMOND", () => {
    expect(rankForXp(1_000_000)).toBe("DIAMOND");
  });
  it("treats negative xp as BRONZE", () => {
    expect(rankForXp(-50)).toBe("BRONZE");
  });
});

describe("rankProgress", () => {
  it("reports progress within a tier", () => {
    const p = rankProgress(1000); // SILVER tier 500..1500
    expect(p.current).toBe("SILVER");
    expect(p.next).toBe("GOLD");
    expect(p.xpIntoCurrent).toBe(500);
    expect(p.tierSpan).toBe(1000);
    expect(p.progress).toBeCloseTo(0.5);
  });
  it("is complete at the top tier", () => {
    const p = rankProgress(9000);
    expect(p.current).toBe("DIAMOND");
    expect(p.next).toBeNull();
    expect(p.progress).toBe(1);
    expect(p.tierSpan).toBeNull();
  });
  it("has ascending thresholds", () => {
    for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
      expect(RANK_THRESHOLDS[i].minXp).toBeGreaterThan(
        RANK_THRESHOLDS[i - 1].minXp,
      );
    }
  });
});
