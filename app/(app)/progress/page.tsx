import { BookOpen, Clock, Flame, Brain } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProgressData } from "@/lib/progress/service";
import type { ProgressRange } from "@/lib/progress/types";
import { formatDurationShort } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressCharts } from "@/components/progress/progress-charts";
import { ActivityCalendar } from "@/components/progress/activity-calendar";
import { MoodHistory } from "@/components/progress/mood-history";
import { QualityHub } from "@/components/progress/quality-hub";
import { SessionHistory } from "@/components/progress/session-history";
import { ProgressExportButtons } from "@/components/progress/progress-export-buttons";
import { getMoodSummary, purgeExpiredMoodCheckins } from "@/lib/mood/service";
import { after } from "next/server";
import { getMasteryOverview } from "@/lib/mastery/service";
import { MasteryPreview } from "@/components/progress/mastery-preview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireDbUser();
  const query = await searchParams;
  const requestedRange = first(query.range);
  const range: ProgressRange =
    requestedRange === "30d" ||
    requestedRange === "all" ||
    requestedRange === "custom"
      ? requestedRange
      : "90d";
  const page = Math.max(1, Number.parseInt(first(query.page) || "1", 10) || 1);
  const filters = {
    range,
    from: first(query.from),
    to: first(query.to),
    page,
    sessionId: first(query.session),
  };

  const [data, masteryOverview] = await Promise.all([
    getProgressData(user.id, user.timezone || "UTC", filters),
    getMasteryOverview(user.id),
  ]);

  // Retention cleanup is maintenance, not render-critical. Run it after the
  // response so opening Progress is never held up by a delete query.
  after(() => purgeExpiredMoodCheckins(user.id));
  const [moodSummary, moods] = await Promise.all([
    getMoodSummary(user.id),
    prisma.moodCheckin.findMany({
      where: {
        userId: user.id,
        OR: [{ description: { not: null } }, { heading: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        heading: true,
        mood: true,
        valence: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  const stats = [
    {
      label: "Total study time",
      value: formatDurationShort(data.totals.studySeconds),
      icon: Clock,
    },
    {
      label: "Sessions completed",
      value: String(data.totals.sessions),
      icon: BookOpen,
    },
    { label: "Quizzes taken", value: String(data.totals.quizzes), icon: Brain },
    {
      label: "Longest streak",
      value: `${data.totals.longestStreak} ${data.totals.longestStreak === 1 ? "day" : "days"}`,
      icon: Flame,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
            Your study garden
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Progress
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A durable record of the habits you are building.
          </p>
        </div>
        <ProgressExportButtons filters={data.filters} />
      </div>

      <MasteryPreview overview={masteryOverview} />

      <Card className="p-4">
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="space-y-1.5">
            <label htmlFor="progress-range" className="text-xs font-medium">
              Date range
            </label>
            <Select
              name="range"
              defaultValue={range}
              items={{
                "30d": "Last 30 days",
                "90d": "Last 90 days",
                all: "All time",
                custom: "Custom dates",
              }}
            >
              <SelectTrigger id="progress-range" className="w-full min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="progress-from" className="text-xs font-medium">
              From
            </label>
            <input
              id="progress-from"
              name="from"
              type="date"
              defaultValue={filters.from}
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-9 rounded-lg border px-3 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="progress-to" className="text-xs font-medium">
              To
            </label>
            <input
              id="progress-to"
              name="to"
              type="date"
              defaultValue={filters.to}
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-9 rounded-lg border px-3 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
          </div>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </Card>

      <QualityHub quality={data.quality} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {stat.label}
              </span>
              <stat.icon className="text-primary size-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      <SessionHistory
        entries={data.history.entries}
        selected={data.selectedSession}
        filters={data.filters}
        page={data.history.page}
        total={data.history.total}
        totalPages={data.history.totalPages}
      />

      <ProgressCharts data={data} />

      <Card className="p-5">
        <h2 className="mb-1 font-medium">Study activity</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          The last 12 weeks. Deeper green means more minutes studied that day.
        </p>
        <ActivityCalendar data={data.activityCalendar} />
      </Card>

      <MoodHistory
        entries={moods}
        summary={moodSummary}
        timezone={user.timezone || "UTC"}
      />
    </div>
  );
}
