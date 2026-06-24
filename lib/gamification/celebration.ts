// =============================================================================
// FILE: lib/gamification/celebration.ts
// WHAT THIS FILE DOES:
//   Defines the small "what to celebrate" message that the server hands back to
//   the browser after an action (finishing a quiz, a session, etc.). If the
//   action unlocked a trophy or moved the student up a rank, that goes in here,
//   and the browser then shows the confetti pop-up.
//
//   This file is "client-safe" (no server-only imports), so both the server and
//   the browser can use these shapes. The pop-up itself lives in
//   components/celebration/, and the queue that shows them one at a time lives in
//   lib/stores/celebration-store.ts.
// =============================================================================
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
