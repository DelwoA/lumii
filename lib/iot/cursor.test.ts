import { describe, expect, it } from "vitest";

import {
  clampCursorToPairing,
  decodeEventCursor,
  encodeEventCursor,
  InvalidEventCursorError,
} from "./cursor";

const PEPPER = "test-pepper-with-more-than-thirty-two-characters";

describe("IoT event cursors", () => {
  it("round-trips the stable event position", () => {
    const cursor = {
      createdAt: new Date("2026-07-29T10:00:00.000Z"),
      id: "event_123",
    };
    expect(
      decodeEventCursor(encodeEventCursor(cursor, PEPPER), PEPPER),
    ).toEqual(cursor);
  });

  it("rejects tampered, oversized, and malformed cursors", () => {
    const valid = encodeEventCursor(
      { createdAt: new Date("2026-07-29T10:00:00.000Z"), id: "event_123" },
      PEPPER,
    );
    expect(() => decodeEventCursor(`${valid}x`, PEPPER)).toThrow(
      InvalidEventCursorError,
    );
    expect(() => decodeEventCursor("x".repeat(513), PEPPER)).toThrow(
      InvalidEventCursorError,
    );
    expect(() => decodeEventCursor("not-a-cursor", PEPPER)).toThrow(
      InvalidEventCursorError,
    );
  });

  it("prevents a cursor from reading events before pairing", () => {
    const pairedAt = new Date("2026-07-29T10:00:00.000Z");
    expect(
      clampCursorToPairing(
        { createdAt: new Date("2026-07-28T10:00:00.000Z"), id: "old" },
        pairedAt,
      ),
    ).toEqual({ createdAt: pairedAt, id: "" });
  });
});
