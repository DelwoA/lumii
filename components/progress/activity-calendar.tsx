import { cn } from "@/lib/utils";

/** Map study minutes to a discrete intensity level (0-4) for the heatmap. */
function level(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

function weekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon = 0
}

function label(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * GitHub-style study-activity grid: weeks as columns, weekdays as rows, lime
 * intensity by minutes studied. Pure server component (native title tooltips).
 */
export function ActivityCalendar({
  data,
}: {
  data: { date: string; minutes: number }[];
}) {
  if (data.length === 0) return null;

  // Pad the start so the first cell lands on its correct weekday row.
  const pad = weekday(data[0].date);
  const cells: ({ date: string; minutes: number } | null)[] = [
    ...Array<null>(pad).fill(null),
    ...data,
  ];

  const weeks: ({ date: string; minutes: number } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {Array.from({ length: 7 }).map((_, di) => {
            const cell = week[di] ?? null;
            if (!cell) {
              return <div key={di} className="size-3 rounded-[2px]" />;
            }
            return (
              <div
                key={di}
                title={`${cell.minutes} min · ${label(cell.date)}`}
                className={cn(
                  "size-3 rounded-[2px]",
                  LEVEL_CLASS[level(cell.minutes)],
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
