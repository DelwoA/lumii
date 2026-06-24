// =============================================================================
// FILE: lib/timetable/types.ts
// WHAT THIS FILE DOES:
//   The shared "shape" of a planned session as the Timetable screens use it.
//   Kept separate (no server code) so the calendar/agenda components and the
//   server logic agree on the same fields.
// =============================================================================
import type { SessionStatus } from "@prisma/client";

/** A scheduled session projected for the timetable UI (client-safe). */
export interface TimetableSession {
  id: string;
  title: string;
  subjectName: string | null;
  subjectColor: string | null;
  topicName: string | null;
  goal: string | null;
  plannedStartISO: string;
  plannedEndISO: string;
  plannedLocalDate: string;
  targetDurationSec: number;
  status: SessionStatus;
  /** True once a study session has been started for this plan. */
  hasStudySession: boolean;
}

export interface SubjectOption {
  id: string;
  name: string;
  color: string | null;
  topics: { id: string; name: string }[];
}
