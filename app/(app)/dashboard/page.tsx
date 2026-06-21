import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Crown,
  FileText,
  Flame,
  Upload,
} from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGamificationSummary } from "@/lib/gamification/service";
import { listForLocalDate } from "@/lib/timetable/service";
import { localDateString } from "@/lib/timetable/dates";
import { formatDurationShort } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TodayPlan } from "@/components/dashboard/today-plan";
import { MoodCheckin } from "@/components/mood/mood-checkin";

export const dynamic = "force-dynamic";

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default async function DashboardPage() {
  const user = await requireDbUser();
  const todayLocal = localDateString(new Date(), user.timezone || "UTC");
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [summary, todaySessions, weekAgg, recentMaterials] = await Promise.all([
    getGamificationSummary(user.id),
    listForLocalDate(user.id, todayLocal),
    prisma.studySession.aggregate({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: weekAgo },
      },
      _sum: { actualDurationSec: true },
      _count: true,
    }),
    prisma.material.findMany({
      where: { userId: user.id, status: "READY" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, type: true },
    }),
  ]);

  const studySecondsWeek = weekAgg._sum.actualDurationSec ?? 0;
  const sessionsWeek = weekAgg._count;

  const stats = [
    {
      label: "Current streak",
      value: `${summary.currentStreak} ${summary.currentStreak === 1 ? "day" : "days"}`,
      icon: Flame,
    },
    {
      label: "Sessions this week",
      value: String(sessionsWeek),
      icon: CalendarCheck,
    },
    {
      label: "Study time this week",
      value: formatDurationShort(studySecondsWeek),
      icon: Clock,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{user.displayName ? `, ${user.displayName}` : ""}.
        </h1>
        <p className="text-muted-foreground text-sm">
          Here&apos;s where things stand today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Rank</span>
            <Crown className="text-primary size-4" />
          </div>
          <p className="mt-2 text-xl font-semibold">{titleCase(summary.rank)}</p>
          <Progress value={summary.progress.progress * 100} className="mt-2 h-1.5" />
          <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
            {summary.totalXp.toLocaleString()} XP
          </p>
        </Card>

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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Today&apos;s plan</h2>
            <Link
              href="/timetable"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              Timetable <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <TodayPlan sessions={todaySessions} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Recent materials</h2>
            <Link
              href="/materials"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              All <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {recentMaterials.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No materials yet.{" "}
              <Link
                href="/materials"
                className="text-primary underline-offset-4 hover:underline"
              >
                Upload one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1">
              {recentMaterials.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/materials/${m.id}`}
                    className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    {m.type === "NOTE" ? (
                      <BookOpen className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="truncate">{m.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MoodCheckin />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/timetable">
          <Card className="hover:border-primary/50 flex items-center gap-3 p-4 transition">
            <CalendarPlus className="text-primary size-5" />
            <span className="text-sm font-medium">Plan a session</span>
          </Card>
        </Link>
        <Link href="/materials">
          <Card className="hover:border-primary/50 flex items-center gap-3 p-4 transition">
            <Upload className="text-primary size-5" />
            <span className="text-sm font-medium">Upload material</span>
          </Card>
        </Link>
        <Link href="/subjects">
          <Card className="hover:border-primary/50 flex items-center gap-3 p-4 transition">
            <BookOpen className="text-primary size-5" />
            <span className="text-sm font-medium">Manage subjects</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
