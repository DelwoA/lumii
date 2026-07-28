import { describe, expect, it, vi } from "vitest";
import {
  cleanupExpiredPairingCodes,
  IOT_PAIRING_CODE_RETENTION_MS,
  pairingCodeCleanupCutoff,
  pairingCodeGenerationLimitReached,
} from "./pairing-retention";

describe("IoT pairing-code retention", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("keeps each pairing record for one hour from generation", () => {
    const cutoff = pairingCodeCleanupCutoff(now);

    // A code created one hour ago expired ten minutes after creation.
    expect(cutoff.toISOString()).toBe("2026-07-29T11:10:00.000Z");
    expect(IOT_PAIRING_CODE_RETENTION_MS).toBe(60 * 60 * 1000);
  });

  it("deletes only records whose expiry is older than the cutoff", async () => {
    const expiries = [
      new Date("2026-07-29T11:09:59.999Z"),
      new Date("2026-07-29T11:10:00.000Z"),
      new Date("2026-07-29T11:55:00.000Z"),
    ];
    const deleteBefore = vi.fn(async (cutoff: Date) => ({
      count: expiries.filter((expiry) => expiry < cutoff).length,
    }));

    await expect(cleanupExpiredPairingCodes(now, deleteBefore)).resolves.toBe(
      1,
    );
    expect(deleteBefore).toHaveBeenCalledWith(
      new Date("2026-07-29T11:10:00.000Z"),
    );
  });

  it("retains the five-code generation limit for the newest hour", () => {
    expect(pairingCodeGenerationLimitReached(4)).toBe(false);
    expect(pairingCodeGenerationLimitReached(5)).toBe(true);
    expect(pairingCodeGenerationLimitReached(6)).toBe(true);
  });
});
