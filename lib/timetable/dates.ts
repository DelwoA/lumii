// =============================================================================
// FILE: lib/timetable/dates.ts
// WHAT THIS FILE DOES:
//   Handles dates correctly across time zones. "What day is it" depends on where
//   the student is: 11pm in Sri Lanka can already be the next day in UTC. Because
//   streaks and adherence are counted per local day, these helpers work out the
//   student's LOCAL calendar date reliably (using the built-in Intl tools) rather
//   than trusting the server's clock. Pure logic, unit-tested in dates.test.ts.
// =============================================================================
/**
 * Timezone-aware day-boundary helpers. Streak/adherence logic groups planned
 * sessions by their LOCAL calendar date in the user's timezone, so we derive
 * that date deterministically with Intl rather than from the server's clock.
 */

/** Whether a string is a usable IANA timezone (falls back callers to "UTC"). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The YYYY-MM-DD local date of an instant in the given timezone. */
export function localDateString(date: Date, timeZone: string): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
