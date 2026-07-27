import { describe, expect, it } from "vitest";
import { deriveTimetableStatus } from "./status";

const base = {
  storedStatus: "PLANNED" as const,
  plannedEndMs: 2_000,
  nowMs: 1_000,
  targetDurationSec: 1_000,
  actualDurationSec: 0,
  hasActiveAttempt: false,
};

describe("deriveTimetableStatus", () => {
  it("uses active and cumulative partial states", () => {
    expect(deriveTimetableStatus({ ...base, hasActiveAttempt: true })).toBe(
      "ACTIVE",
    );
    expect(deriveTimetableStatus({ ...base, actualDurationSec: 500 })).toBe(
      "PARTIAL",
    );
  });

  it("completes at the existing 80 percent adherence threshold", () => {
    expect(deriveTimetableStatus({ ...base, actualDurationSec: 799 })).toBe(
      "PARTIAL",
    );
    expect(deriveTimetableStatus({ ...base, actualDurationSec: 800 })).toBe(
      "COMPLETED",
    );
  });

  it("derives missed only when there is no progress", () => {
    expect(deriveTimetableStatus({ ...base, plannedEndMs: 500 })).toBe(
      "MISSED",
    );
    expect(
      deriveTimetableStatus({
        ...base,
        plannedEndMs: 500,
        actualDurationSec: 1,
      }),
    ).toBe("PARTIAL");
  });

  it("keeps terminal states authoritative", () => {
    expect(deriveTimetableStatus({ ...base, storedStatus: "CANCELLED" })).toBe(
      "CANCELLED",
    );
    expect(deriveTimetableStatus({ ...base, storedStatus: "COMPLETED" })).toBe(
      "COMPLETED",
    );
  });
});
