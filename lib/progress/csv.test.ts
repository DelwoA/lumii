import { describe, expect, it } from "vitest";
import { sessionsCsv } from "./csv";
import type { SessionHistoryEntry } from "./types";

const entry: SessionHistoryEntry = {
  id: "session-1",
  title: 'Read "Chapter 1"',
  goal: null,
  subjectName: "Biology",
  topicName: null,
  startedAtISO: "2026-07-27T10:00:00.000Z",
  endedAtISO: "2026-07-27T10:25:00.000Z",
  durationSec: 1500,
  targetDurationSec: 1500,
  scoreStatus: "SCORED",
  qualityScore: 80,
  qualityVersion: "2",
  qualityBreakdown: null,
  goalCompleted: true,
  reflection: "private and intentionally excluded",
  autoClosed: false,
};

describe("sessionsCsv", () => {
  it("escapes values and excludes private reflections", () => {
    const csv = sessionsCsv([entry]);
    expect(csv).toContain('"Read ""Chapter 1"""');
    expect(csv).toContain('"80"');
    expect(csv).not.toContain("private and intentionally excluded");
  });
});
