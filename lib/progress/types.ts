/** Client-safe shapes for the Progress analytics page. */

export interface ProgressTotals {
  studySeconds: number;
  sessions: number;
  quizzes: number;
  currentStreak: number;
  longestStreak: number;
}

export interface ProgressData {
  totals: ProgressTotals;
  /** Study minutes per day, last 14 days. */
  dailyStudy: { date: string; label: string; minutes: number }[];
  /** Cumulative XP per day, last 30 days. */
  xpCumulative: { date: string; label: string; xp: number }[];
  /** Adherence percentage per week, last 6 weeks. */
  weeklyAdherence: { week: string; pct: number }[];
  /** Study minutes per day, last 84 days (12-week activity grid). */
  activityCalendar: { date: string; minutes: number }[];
}
