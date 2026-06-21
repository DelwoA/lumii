import { describe, expect, it } from "vitest";
import {
  HARD_CAP_SEC,
  IDLE_TIMEOUT_SEC,
  autoCloseDecision,
  creditedDurationSec,
} from "./timing";

const T0 = 1_700_000_000_000; // fixed epoch ms

describe("creditedDurationSec", () => {
  it("credits whole seconds between two instants", () => {
    expect(creditedDurationSec(T0, T0 + 90_000)).toBe(90);
  });

  it("never goes negative for a backwards interval", () => {
    expect(creditedDurationSec(T0, T0 - 5_000)).toBe(0);
  });

  it("caps at the hard cap", () => {
    expect(creditedDurationSec(T0, T0 + (HARD_CAP_SEC + 600) * 1000)).toBe(
      HARD_CAP_SEC,
    );
  });

  it("floors partial seconds", () => {
    expect(creditedDurationSec(T0, T0 + 1_999)).toBe(1);
  });
});

describe("autoCloseDecision", () => {
  it("keeps an actively-beating session open", () => {
    const d = autoCloseDecision(
      { startedAtMs: T0, lastHeartbeatMs: T0 + 60_000 },
      T0 + 70_000,
    );
    expect(d.shouldClose).toBe(false);
    expect(d.reason).toBeNull();
    expect(d.endMs).toBe(T0 + 70_000);
  });

  it("auto-closes on idle, crediting up to the last heartbeat", () => {
    const lastBeat = T0 + 120_000;
    const now = lastBeat + IDLE_TIMEOUT_SEC * 1000 + 1_000;
    const d = autoCloseDecision(
      { startedAtMs: T0, lastHeartbeatMs: lastBeat },
      now,
    );
    expect(d.shouldClose).toBe(true);
    expect(d.reason).toBe("idle");
    expect(d.endMs).toBe(lastBeat);
  });

  it("uses startedAt as the heartbeat baseline when none recorded", () => {
    const now = T0 + IDLE_TIMEOUT_SEC * 1000 + 1;
    const d = autoCloseDecision({ startedAtMs: T0, lastHeartbeatMs: null }, now);
    expect(d.shouldClose).toBe(true);
    expect(d.reason).toBe("idle");
    expect(d.endMs).toBe(T0);
  });

  it("auto-closes on the hard cap even with recent heartbeats", () => {
    const capEnd = T0 + HARD_CAP_SEC * 1000;
    const d = autoCloseDecision(
      { startedAtMs: T0, lastHeartbeatMs: capEnd - 1_000 },
      capEnd + 5_000,
    );
    expect(d.shouldClose).toBe(true);
    expect(d.reason).toBe("cap");
    expect(d.endMs).toBe(capEnd);
  });

  it("prefers the cap reason over idle at the boundary", () => {
    const capEnd = T0 + HARD_CAP_SEC * 1000;
    // No heartbeat for a long time AND past the cap: cap takes precedence.
    const d = autoCloseDecision({ startedAtMs: T0, lastHeartbeatMs: T0 }, capEnd);
    expect(d.reason).toBe("cap");
    expect(d.endMs).toBe(capEnd);
  });
});
