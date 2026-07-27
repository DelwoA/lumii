import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Sprout } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { QualitySummary } from "@/lib/progress/types";

export function QualityHub({ quality }: { quality: QualitySummary }) {
  const trend = quality.trend;
  const TrendIcon =
    trend == null || trend === 0
      ? Minus
      : trend > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <Card className="border-primary/20 overflow-hidden p-0">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-6 sm:p-8">
          <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
            <Sprout className="size-4" aria-hidden="true" />
            Session quality
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-muted-foreground text-sm">
                Average in this range
              </p>
              <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                {quality.average ?? "—"}
                {quality.average != null ? (
                  <span className="text-muted-foreground text-xl">/100</span>
                ) : null}
              </p>
            </div>
            <div className="pb-1">
              <p className="text-muted-foreground text-sm">Direction</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium">
                <TrendIcon className="size-4" aria-hidden="true" />
                {trend == null
                  ? "Needs more sessions"
                  : trend === 0
                    ? "Holding steady"
                    : `${trend > 0 ? "+" : ""}${trend} points`}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-6 max-w-2xl text-sm leading-6">
            A transparent measure of duration follow-through, goal completion,
            intentional finishing, and verified learning activity. It does not
            measure intelligence, attention, or subject mastery.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="bg-secondary rounded-full px-3 py-1.5">
              {quality.scoredSessions} scored
            </span>
            <span className="bg-muted rounded-full px-3 py-1.5">
              {quality.unscoredSessions} not scored
            </span>
          </div>
        </div>

        <div className="bg-secondary/55 border-primary/15 grid min-h-72 place-items-center border-t p-5 lg:border-t-0 lg:border-l">
          {quality.recentScores.length ? (
            <svg
              viewBox="0 0 260 260"
              className="size-64 max-w-full"
              role="img"
              aria-labelledby="quality-rings-title quality-rings-desc"
            >
              <title id="quality-rings-title">
                Recent quality growth rings
              </title>
              <desc id="quality-rings-desc">
                Each ring is one recent session. A more complete ring represents
                a higher quality score.
              </desc>
              <circle cx="130" cy="130" r="28" fill="#FBFAF6" />
              {quality.recentScores
                .slice()
                .reverse()
                .slice(0, 8)
                .map((session, index) => {
                  const radius = 38 + index * 12;
                  const circumference = 2 * Math.PI * radius;
                  const filled = (session.score / 100) * circumference;
                  return (
                    <Link
                      href={`/progress?session=${session.id}`}
                      key={session.id}
                      aria-label={`Open session scored ${session.score} out of 100`}
                    >
                      <circle
                        cx="130"
                        cy="130"
                        r={radius}
                        fill="none"
                        stroke="#FBFAF6"
                        strokeWidth="7"
                      />
                      <circle
                        cx="130"
                        cy="130"
                        r={radius}
                        fill="none"
                        stroke={index % 2 ? "#78936C" : "#2F6048"}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${filled} ${circumference - filled}`}
                        transform="rotate(-90 130 130)"
                        className="transition-opacity hover:opacity-70"
                      />
                    </Link>
                  );
                })}
              <path
                d="M130 145c-8-11-6-25 4-35 11 9 13 23 5 34-3 4-6 7-9 9-2-2-2-5 0-8Z"
                fill="#2F6048"
              />
            </svg>
          ) : (
            <div className="max-w-56 text-center">
              <div className="bg-card mx-auto grid size-14 place-items-center rounded-full shadow-sm">
                <Sprout className="text-primary size-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium">Your growth rings start here</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Complete a targeted session of at least 10 minutes.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
