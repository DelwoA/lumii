export const ADHERENCE_THRESHOLD = 0.8;

export interface PlannedDay {
  /** YYYY-MM-DD in the user's timezone. */
  date: string;
  plannedMinutes: number;
  completedMinutes: number;
}

export function dayAdherence(day: PlannedDay): number {
  if (day.plannedMinutes <= 0) return 0;
  return day.completedMinutes / day.plannedMinutes;
}

/** A day is "adherent" if at least 80% of its planned minutes were completed. */
export function isAdherent(day: PlannedDay): boolean {
  return day.plannedMinutes > 0 && dayAdherence(day) >= ADHERENCE_THRESHOLD;
}

/** A "perfect day" completed 100% of its planned minutes (badge, not streak). */
export function isPerfectDay(day: PlannedDay): boolean {
  return day.plannedMinutes > 0 && day.completedMinutes >= day.plannedMinutes;
}

export interface StreakResult {
  current: number;
  longest: number;
  lastAdherentDay: string | null;
}

/**
 * Adherence streak over PLANNED days only. Days with no plan are neutral and
 * skipped (they neither extend nor break the run); a planned day below the
 * threshold breaks it. `days` may be unsorted.
 */
export function computeAdherenceStreak(days: PlannedDay[]): StreakResult {
  const planned = days
    .filter((d) => d.plannedMinutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  let longest = 0;
  let lastAdherentDay: string | null = null;

  for (const day of planned) {
    if (isAdherent(day)) {
      current += 1;
      longest = Math.max(longest, current);
      lastAdherentDay = day.date;
    } else {
      current = 0;
    }
  }

  return { current, longest, lastAdherentDay };
}
