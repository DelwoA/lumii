import { describe, expect, it } from "vitest";

import {
  hourInTimeZone,
  mapDeviceEvent,
  sanitizeReminderTitle,
} from "./projection";

const occurredAt = new Date("2026-07-29T10:00:00.000Z");

describe("IoT status projection", () => {
  it("sanitizes and limits reminder titles", () => {
    expect(sanitizeReminderTitle("  Algebra\n  review\u0000  ")).toBe(
      "Algebra review",
    );
    expect(sanitizeReminderTitle("a".repeat(100))).toHaveLength(80);
  });

  it("maps rank and trophy events without private payload fields", () => {
    expect(
      mapDeviceEvent({
        id: "rank",
        type: "RANK_UP",
        sourceId: "SILVER",
        payload: {
          fromRank: "BRONZE",
          toRank: "SILVER",
          privateNote: "must not escape",
        },
        createdAt: occurredAt,
      }),
    ).toEqual({
      id: "rank",
      type: "rank_up",
      occurredAt: occurredAt.toISOString(),
      data: { fromRank: "BRONZE", toRank: "SILVER" },
    });

    expect(
      mapDeviceEvent({
        id: "trophy",
        type: "TROPHY_UNLOCKED",
        sourceId: "FIRST_QUIZ",
        payload: null,
        createdAt: occurredAt,
      }),
    ).toMatchObject({
      type: "trophy_unlocked",
      data: { code: "FIRST_QUIZ" },
    });
  });

  it("calculates quiz percentage and perfect status", () => {
    expect(
      mapDeviceEvent({
        id: "quiz",
        type: "QUIZ_COMPLETED",
        sourceId: null,
        payload: { correctCount: 2, questionCount: 3 },
        createdAt: occurredAt,
      }),
    ).toMatchObject({
      type: "quiz_completed",
      data: {
        correctCount: 2,
        questionCount: 3,
        scorePercent: 66.67,
        perfect: false,
      },
    });
  });

  it("drops malformed or non-allowlisted events", () => {
    expect(
      mapDeviceEvent({
        id: "rank",
        type: "RANK_UP",
        sourceId: null,
        payload: { fromRank: "BRONZE", toRank: "NOT_A_RANK" },
        createdAt: occurredAt,
      }),
    ).toBeNull();
    expect(
      mapDeviceEvent({
        id: "trophy",
        type: "TROPHY_UNLOCKED",
        sourceId: "x".repeat(65),
        payload: null,
        createdAt: occurredAt,
      }),
    ).toBeNull();
    expect(
      mapDeviceEvent({
        id: "quiz",
        type: "QUIZ_COMPLETED",
        sourceId: null,
        payload: { correctCount: 4, questionCount: 3 },
        createdAt: occurredAt,
      }),
    ).toBeNull();
    expect(
      mapDeviceEvent({
        id: "mood",
        type: "MOOD_LOGGED",
        sourceId: null,
        payload: { description: "private" },
        createdAt: occurredAt,
      }),
    ).toBeNull();
  });

  it("reads the hour in the supplied timezone", () => {
    expect(hourInTimeZone(new Date("2026-07-29T18:30:00.000Z"), "UTC")).toBe(
      18,
    );
    expect(
      hourInTimeZone(new Date("2026-07-29T18:30:00.000Z"), "Asia/Colombo"),
    ).toBe(0);
  });
});
