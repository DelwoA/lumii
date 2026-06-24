import { Card } from "@/components/ui/card";

export interface MoodEntry {
  id: string;
  heading: string | null;
  mood: string | null;
  valence: string | null;
  description: string | null;
  createdAt: Date;
}

const WINDOW_DAYS = 14;

/** Deterministic "average feeling" over the recent window, from valence counts. */
function summarize(entries: MoodEntry[]) {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => e.createdAt.getTime() >= cutoff);
  let pos = 0;
  let neu = 0;
  let neg = 0;
  for (const e of recent) {
    if (e.valence === "POSITIVE") pos += 1;
    else if (e.valence === "NEGATIVE") neg += 1;
    else neu += 1;
  }
  const total = pos + neu + neg;
  if (total === 0) return null;
  const headline =
    pos > neu && pos > neg
      ? "Mostly positive lately"
      : neg > neu && neg > pos
        ? "A tough stretch lately"
        : "A balanced mix lately";
  return { headline, pos, neu, neg, total };
}

/**
 * The private mood log on the Progress page: a deterministic "average feeling"
 * summary plus each timestamped check-in (heading, mood, original description).
 */
export function MoodHistory({
  entries,
  timezone,
}: {
  entries: MoodEntry[];
  timezone: string;
}) {
  const summary = summarize(entries);
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
            Last {WINDOW_DAYS} days · {summary.total} check-in
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
