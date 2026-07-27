import type { SessionQualityBreakdown } from "@/lib/gamification/session-quality";

export type ProgressRange = "30d" | "90d" | "all" | "custom";

export interface ProgressFilters {
  range: ProgressRange;
  from?: string;
  to?: string;
  page: number;
  sessionId?: string;
}

export interface ProgressTotals {
  studySeconds: number;
  sessions: number;
  quizzes: number;
  currentStreak: number;
  longestStreak: number;
}

export interface SessionHistoryEntry {
  id: string;
  title: string;
  goal: string | null;
  subjectName: string | null;
  topicName: string | null;
  startedAtISO: string;
  endedAtISO: string;
  durationSec: number;
  targetDurationSec: number | null;
  scoreStatus: "PENDING" | "SCORED" | "TOO_SHORT" | "NO_TARGET";
  qualityScore: number | null;
  qualityVersion: string | null;
  qualityBreakdown: SessionQualityBreakdown | null;
  goalCompleted: boolean | null;
  reflection: string | null;
  autoClosed: boolean;
}

export interface QualitySummary {
  average: number | null;
  scoredSessions: number;
  unscoredSessions: number;
  trend: number | null;
  recentScores: {
    id: string;
    score: number;
    startedAtISO: string;
  }[];
}

export interface ProgressData {
  totals: ProgressTotals;
  dailyStudy: { date: string; label: string; minutes: number }[];
  xpCumulative: { date: string; label: string; xp: number }[];
  weeklyAdherence: { week: string; pct: number }[];
  activityCalendar: { date: string; minutes: number }[];
  quality: QualitySummary;
  history: {
    entries: SessionHistoryEntry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  selectedSession: SessionHistoryEntry | null;
  filters: ProgressFilters;
}
