// =============================================================================
// FILE: components/progress/mood-history.tsx
// WHAT THIS FILE DOES:
//   The private mood log shown at the bottom of the Progress page. It displays
//   the "average feeling" summary (worked out on the server) and then each
//   check-in in order: heading, date/time, mood, and the words the student
//   wrote. It only shows data, so it is safe as a server-rendered component.
// =============================================================================
import { Card } from "@/components/ui/card";
import { MOOD_WINDOW_DAYS, type MoodSummary } from "@/lib/mood/summary";

export interface MoodEntry {
  id: string;
  heading: string | null;
  mood: string | null;
  valence: string | null;
  description: string | null;
  createdAt: Date;
}

/**
 * The private mood log on the Progress page: a deterministic "average feeling"
 * summary (computed server-side over the full window) plus each timestamped
 * check-in (heading, mood, original description).
 */
export function MoodHistory({
  entries,
  summary,
  timezone,
}: {
  entries: MoodEntry[];
  summary: MoodSummary | null;
  timezone: string;
}) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-medium">Mood</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Your private study check-ins. Only you can see these.
      </p>

      {summary ? (
        <div className="bg-muted/30 mb-4 rounded-xl p-4">
          <p className="font-medium">{summary.headline}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Last {MOOD_WINDOW_DAYS} days · {summary.total} check-in
            {summary.total === 1 ? "" : "s"} · {summary.pos} positive ·{" "}
            {summary.neu} neutral · {summary.neg} low
          </p>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No check-ins yet. Share how studying feels from the dashboard.
        </p>
      ) : (
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={e.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{e.heading ?? "Check-in"}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {fmt.format(e.createdAt)}
                </span>
              </div>
              {e.mood ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  <span className="text-foreground/80 font-medium">Mood:</span>{" "}
                  {e.mood}
                </p>
              ) : null}
              {e.description ? (
                <p className="text-muted-foreground mt-0.5 text-sm">
                  <span className="text-foreground/80 font-medium">
                    Entered description:
                  </span>{" "}
                  {e.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
