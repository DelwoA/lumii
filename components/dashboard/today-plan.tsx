// =============================================================================
// FILE: components/dashboard/today-plan.tsx
// WHAT THIS FILE DOES:
//   The "Today's plan" block on the Dashboard. It lists the sessions planned for
//   today and lets the student start one directly from here.
// =============================================================================
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/stores/session-store";
import { formatDurationShort } from "@/lib/format";
import type { TimetableSession } from "@/lib/timetable/types";

function startTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TodayPlan({ sessions }: { sessions: TimetableSession[] }) {
  const router = useRouter();
  const active = useSessionStore((s) => s.active);
  const start = useSessionStore((s) => s.start);

  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing planned for today.{" "}
        <Link href="/timetable" className="text-primary underline-offset-4 hover:underline">
          Plan a session
        </Link>
        .
      </p>
    );
  }

  async function onStart(s: TimetableSession) {
    if (active) {
      toast.error("Finish your current session first");
      return;
    }
    const res = await start(s.id);
    if (res.ok) {
      toast.success("Session started");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not start the session");
    }
  }

  return (
    <ul className="divide-y">
      {sessions.map((s) => {
        const done = s.status === "COMPLETED";
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.title}</span>
                {s.status === "MISSED" ? (
                  <Badge variant="destructive">Missed</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {startTime(s.plannedStartISO)} ·{" "}
                {formatDurationShort(s.targetDurationSec)}
                {s.subjectName ? ` · ${s.subjectName}` : ""}
              </p>
            </div>
            {done ? (
              <span className="text-primary flex items-center gap-1 text-xs font-medium">
                <Check className="size-4" />
                Done
              </span>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onStart(s)}
                disabled={Boolean(active)}
              >
                <Play className="size-3.5" />
                Start
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
