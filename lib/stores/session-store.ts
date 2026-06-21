"use client";

import { create } from "zustand";
import type { ActiveSession } from "@/lib/sessions/types";
import {
  getActiveSessionAction,
  heartbeatAction,
  startSessionAction,
  stopSessionAction,
} from "@/app/(app)/sessions/actions";

interface StopOutcome {
  ok: boolean;
  durationSec?: number;
  qualityScore?: number | null;
  scored?: boolean;
  error?: string;
}

interface SessionState {
  active: ActiveSession | null;
  /** True once the initial server fetch has resolved (avoids a flash). */
  hydrated: boolean;
  starting: boolean;
  stopping: boolean;
  refresh: () => Promise<void>;
  start: (
    scheduledSessionId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  stop: (opts: { goalCompleted?: boolean; reflection?: string }) => Promise<StopOutcome>;
  beat: () => Promise<void>;
}

/**
 * Global client state for the single active study session. The persistent
 * session bar, the topbar Start button, and the timetable Start actions all
 * read/write through this store so they stay in sync without a full reload.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  active: null,
  hydrated: false,
  starting: false,
  stopping: false,

  async refresh() {
    const active = await getActiveSessionAction();
    set({ active, hydrated: true });
  },

  async start(scheduledSessionId) {
    if (get().starting) return { ok: false, error: "Already starting" };
    set({ starting: true });
    const res = await startSessionAction(scheduledSessionId);
    set({ starting: false });
    if (res.ok) {
      set({ active: res.active });
      return { ok: true };
    }
    return { ok: false, error: res.error };
  },

  async stop(opts) {
    const active = get().active;
    if (!active) return { ok: false, error: "No active session" };
    set({ stopping: true });
    const res = await stopSessionAction(active.id, opts);
    set({ stopping: false, active: null });
    return res.ok
      ? {
          ok: true,
          durationSec: res.durationSec,
          qualityScore: res.qualityScore,
          scored: res.scored,
        }
      : { ok: false, error: res.error };
  },

  async beat() {
    const active = get().active;
    if (!active) return;
    // Only count time while the tab is actually visible; a hidden tab going
    // quiet is what lets the server's idle auto-close kick in.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    const res = await heartbeatAction(active.id);
    if (!res.open) set({ active: null });
  },
}));
