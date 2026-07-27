export type TimetableDisplayStatus =
  | "PLANNED"
  | "ACTIVE"
  | "PARTIAL"
  | "COMPLETED"
  | "MISSED"
  | "CANCELLED";

export interface TimetableSession {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  topicId: string | null;
  topicName: string | null;
  goal: string | null;
  plannedStartISO: string;
  plannedEndISO: string;
  plannedLocalDate: string;
  planningTimezone: string;
  targetDurationSec: number;
  actualDurationSec: number;
  remainingDurationSec: number;
  completionPercent: number;
  attemptCount: number;
  latestQualityScore: number | null;
  status: TimetableDisplayStatus;
  canEdit: boolean;
  canCancel: boolean;
}

export interface SubjectOption {
  id: string;
  name: string;
  color: string | null;
  topics: { id: string; name: string }[];
}
