import {
  Award,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Footprints,
  Lock,
  Repeat,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { getAchievementsData } from "@/lib/gamification/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  Award,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Footprints,
  Repeat,
  Sparkles,
  Target,
};

function titleCase(rank: string): string {
  return rank.charAt(0) + rank.slice(1).toLowerCase();
}

export default async function AchievementsPage() {
  const user = await requireDbUser();
  const data = await getAchievementsData(user.id);
  const { progress } = data;
  const xpToNext =
    progress.next && progress.tierSpan !== null
      ? Math.max(0, progress.tierSpan - progress.xpIntoCurrent)
      : 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground text-sm">
          Your rank, streak, and trophies. Keep studying to unlock more.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Rank</span>
            <Badge className="gap-1">
              <Crown className="size-3.5" />
              {titleCase(data.rank)}
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {data.totalXp.toLocaleString()} XP
          </p>
          <Progress value={progress.progress * 100} className="mt-3" />
          <p className="text-muted-foreground mt-2 text-xs">
            {progress.next
              ? `${xpToNext.toLocaleString()} XP to ${titleCase(progress.next)}`
              : "Top rank reached"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Current streak</span>
            <Flame className="text-primary size-4" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {data.currentStreak} {data.currentStreak === 1 ? "day" : "days"}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Longest: {data.longestStreak}{" "}
            {data.longestStreak === 1 ? "day" : "days"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Trophies</span>
            <Trophy className="text-primary size-4" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {data.unlockedCount} / {data.trophies.length}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">unlocked</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.trophies.map((t) => {
          const Icon = ICONS[t.icon] ?? Trophy;
          return (
            <Card
              key={t.code}
              className={cn(
                "flex items-start gap-4 p-4 transition",
                t.unlocked ? "border-primary/40" : "opacity-60 saturate-0",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  t.unlocked
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {t.unlocked ? <Icon className="size-5" /> : <Lock className="size-4" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium">{t.name}</p>
                <p className="text-muted-foreground text-sm">{t.description}</p>
                {t.unlocked && t.unlockedAtISO ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Unlocked{" "}
                    {new Date(t.unlockedAtISO).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                ) : t.xp > 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">+{t.xp} XP</p>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
