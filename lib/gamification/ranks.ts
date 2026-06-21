import type { Rank } from "@prisma/client";

/** XP thresholds per rank (ascending). Published + deterministic for the viva. */
export const RANK_THRESHOLDS: ReadonlyArray<{ rank: Rank; minXp: number }> = [
  { rank: "BRONZE", minXp: 0 },
  { rank: "SILVER", minXp: 500 },
  { rank: "GOLD", minXp: 1500 },
  { rank: "PLATINUM", minXp: 3500 },
  { rank: "DIAMOND", minXp: 7000 },
];

/** The rank a given total XP earns. */
export function rankForXp(totalXp: number): Rank {
  let result: Rank = "BRONZE";
  for (const tier of RANK_THRESHOLDS) {
    if (totalXp >= tier.minXp) result = tier.rank;
  }
  return result;
}

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** XP accumulated within the current tier. */
  xpIntoCurrent: number;
  /** XP span of the current tier (null at the top tier). */
  tierSpan: number | null;
  /** 0..1 progress toward the next rank (1 at the top tier). */
  progress: number;
}

export function rankProgress(totalXp: number): RankProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const current = rankForXp(xp);
  const idx = RANK_THRESHOLDS.findIndex((t) => t.rank === current);
  const currentMin = RANK_THRESHOLDS[idx].minXp;
  const nextTier = RANK_THRESHOLDS[idx + 1] ?? null;

  if (!nextTier) {
    return {
      current,
      next: null,
      xpIntoCurrent: xp - currentMin,
      tierSpan: null,
      progress: 1,
    };
  }

  const tierSpan = nextTier.minXp - currentMin;
  const xpIntoCurrent = xp - currentMin;
  return {
    current,
    next: nextTier.rank,
    xpIntoCurrent,
    tierSpan,
    progress: tierSpan > 0 ? Math.min(1, xpIntoCurrent / tierSpan) : 1,
  };
}
