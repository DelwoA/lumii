import type { Rank } from "@prisma/client";

/** A trophy that was just unlocked by a user action (client-safe). */
export interface UnlockedTrophy {
  code: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
}

/** Awards produced by a single user action, surfaced for the celebration UI. */
export interface Celebration {
  trophies: UnlockedTrophy[];
  /** The new rank if the user ranked up during this action, else null. */
  rankUp: Rank | null;
}

export const NO_CELEBRATION: Celebration = { trophies: [], rankUp: null };

/** True when there is anything worth celebrating. */
export function hasCelebration(c: Celebration | null | undefined): boolean {
  return Boolean(c && (c.trophies.length > 0 || c.rankUp));
}
