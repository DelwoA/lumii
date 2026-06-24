// =============================================================================
// FILE: app/(app)/progress/page.tsx   ->   web address: /progress
// WHAT THIS FILE DOES:
//   The Progress page. It loads the analytics (study time, sessions, quizzes,
//   streak, chart data) and the private mood log, then lays out the summary
//   cards, the charts, the study-activity calendar, and the mood history. It
//   also tidies up any expired old mood check-ins when the page is opened.
// =============================================================================
import { BookOpen, Clock, Flame, Brain } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProgressData } from "@/lib/progress/service";
import { formatDurationShort } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ProgressCharts } from "@/components/progress/progress-charts";
import { ActivityCalendar } from "@/components/progress/activity-calendar";
import { MoodHistory } from "@/components/progress/mood-history";
import {
  getMoodSummary,
  purgeExpiredMoodCheckins,
} from "@/lib/mood/service";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireDbUser();
  const data = await getProgressData(user.id, user.timezone || "UTC");

  // Purge expired (legacy) check-ins on access before reading the log.
  await purgeExpiredMoodCheckins(user.id);
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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm">
          How your studying is trending over time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <s.icon className="text-primary size-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <ProgressCharts data={data} />

      <Card className="p-5">
        <h2 className="mb-1 font-medium">Study activity</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          The last 12 weeks. Darker means more minutes studied that day.
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
