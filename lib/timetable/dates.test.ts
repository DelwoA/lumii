import { describe, expect, it } from "vitest";
import { isValidTimeZone, localDateString } from "./dates";

describe("isValidTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Asia/Colombo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects empty or bogus zones", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("localDateString", () => {
  it("returns the UTC calendar date for UTC", () => {
    expect(localDateString(new Date("2026-06-22T02:00:00Z"), "UTC")).toBe(
      "2026-06-22",
    );
  });

  it("rolls back a day for a western zone before midnight UTC", () => {
    // 02:00Z is the previous evening in New York (UTC-4 in June).
    expect(
      localDateString(new Date("2026-06-22T02:00:00Z"), "America/New_York"),
    ).toBe("2026-06-21");
  });

  it("rolls forward a day for an eastern zone", () => {
    // 22:00Z is past midnight in Colombo (UTC+5:30).
    expect(
      localDateString(new Date("2026-06-21T22:00:00Z"), "Asia/Colombo"),
    ).toBe("2026-06-22");
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(localDateString(new Date("2026-06-22T02:00:00Z"), "bogus")).toBe(
      "2026-06-22",
    );
  });
});
