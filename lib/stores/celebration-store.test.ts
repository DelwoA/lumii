import { describe, it, expect, beforeEach } from "vitest";
import { useCelebrationStore } from "./celebration-store";
import {
  NO_CELEBRATION,
  type UnlockedTrophy,
} from "@/lib/gamification/celebration";

function makeTrophy(code: string): UnlockedTrophy {
  return {
    code,
    name: `Trophy ${code}`,
    description: "Earned an award.",
    icon: "trophy",
    xp: 25,
  };
}

const store = useCelebrationStore;

describe("celebration store", () => {
  beforeEach(() => {
    store.setState({ current: null, queue: [] });
  });

  it("ignores empty or missing celebrations", () => {
    store.getState().celebrate(NO_CELEBRATION);
    store.getState().celebrate(null);
    store.getState().celebrate(undefined);
    expect(store.getState().current).toBeNull();
    expect(store.getState().queue).toEqual([]);
  });

  it("shows the first award and queues the rest", () => {
    store.getState().celebrate({
      trophies: [makeTrophy("a"), makeTrophy("b")],
      rankUp: "SILVER",
    });
    expect(store.getState().current).toEqual({
      kind: "trophy",
      trophy: makeTrophy("a"),
    });
    expect(store.getState().queue).toHaveLength(2);
  });

  it("orders trophies before the rank-up", () => {
    store.getState().celebrate({ trophies: [makeTrophy("a")], rankUp: "GOLD" });
    expect(store.getState().current).toEqual({
      kind: "trophy",
      trophy: makeTrophy("a"),
    });
    expect(store.getState().queue).toEqual([{ kind: "rank", rank: "GOLD" }]);
  });

  it("advances through the queue on dismiss, then clears", () => {
    store.getState().celebrate({ trophies: [makeTrophy("a")], rankUp: "GOLD" });
    store.getState().dismiss();
    expect(store.getState().current).toEqual({ kind: "rank", rank: "GOLD" });
    expect(store.getState().queue).toEqual([]);
    store.getState().dismiss();
    expect(store.getState().current).toBeNull();
  });

  it("appends new awards behind the one already showing", () => {
    store.getState().celebrate({ trophies: [makeTrophy("a")], rankUp: null });
    store.getState().celebrate({ trophies: [makeTrophy("b")], rankUp: null });
    // The first stays on screen; the second waits in the queue.
    expect(store.getState().current).toEqual({
      kind: "trophy",
      trophy: makeTrophy("a"),
    });
    expect(store.getState().queue).toEqual([
      { kind: "trophy", trophy: makeTrophy("b") },
    ]);
  });

  it("dismiss on an empty store is a no-op", () => {
    store.getState().dismiss();
    expect(store.getState().current).toBeNull();
    expect(store.getState().queue).toEqual([]);
  });
});
