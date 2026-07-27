import type { SessionHistoryEntry } from "./types";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function sessionsCsv(sessions: SessionHistoryEntry[]) {
  const header = [
    "Date",
    "Title",
    "Subject",
    "Topic",
    "Duration minutes",
    "Target minutes",
    "Score status",
    "Quality score",
    "Quality version",
    "Goal completed",
  ];
  const rows = sessions.map((session) => [
    session.startedAtISO,
    session.title,
    session.subjectName,
    session.topicName,
    Math.round(session.durationSec / 60),
    session.targetDurationSec == null
      ? ""
      : Math.round(session.targetDurationSec / 60),
    session.scoreStatus,
    session.qualityScore,
    session.qualityVersion,
    session.goalCompleted,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
