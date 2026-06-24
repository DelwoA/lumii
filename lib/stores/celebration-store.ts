// =============================================================================
// FILE: lib/stores/celebration-store.ts
// WHAT THIS FILE DOES:
//   A small browser store (Zustand) that holds a QUEUE of things to celebrate
//   (trophies unlocked, a rank-up). If several happen at once, they are shown
//   one at a time so the confetti pop-ups do not pile on top of each other. The
//   pop-up component reads from here; unit-tested in celebration-store.test.ts.
// =============================================================================
"use client";

import { create } from "zustand";
import type { Celebration, UnlockedTrophy } from "@/lib/gamification/celebration";

/** A single thing to celebrate, shown one at a time. */
export type AwardItem =
  | { kind: "trophy"; trophy: UnlockedTrophy }
  | { kind: "rank"; rank: string };

interface CelebrationState {
  current: AwardItem | null;
  queue: AwardItem[];
  /** Enqueue the awards from an action result; safe to call with no awards. */
  celebrate: (c: Celebration | null | undefined) => void;
  /** Dismiss the current award and advance to the next queued one. */
  dismiss: () => void;
}

/**
 * Global queue for celebratory award popups. Actions that can grant awards
 * (quiz, summary, session) pass their returned `celebration` here, and the
 * CelebrationOverlay renders each one with confetti, one after another.
 */
export const useCelebrationStore = create<CelebrationState>((set) => ({
  current: null,
  queue: [],

  celebrate: (c) => {
    if (!c) return;
    const items: AwardItem[] = [];
    for (const trophy of c.trophies) items.push({ kind: "trophy", trophy });
    if (c.rankUp) items.push({ kind: "rank", rank: c.rankUp });
    if (items.length === 0) return;

    set((s) => {
      const all = [...s.queue, ...items];
      if (!s.current) {
        const [first, ...rest] = all;
        return { current: first, queue: rest };
      }
      return { queue: all };
    });
  },

  dismiss: () =>
    set((s) => {
      const [first, ...rest] = s.queue;
      return { current: first ?? null, queue: rest };
    }),
}));
