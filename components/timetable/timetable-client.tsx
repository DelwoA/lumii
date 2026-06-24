// =============================================================================
// FILE: components/timetable/timetable-client.tsx
// WHAT THIS FILE DOES:
//   The interactive Timetable (browser side): the month and week views, the list
//   of planned sessions, and the buttons to add, edit, cancel, or start a
//   session. It opens the scheduled-session-form for create/edit and calls the
//   timetable server actions. The page that loads the data is the timetable page.
// =============================================================================
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LumenSpark } from "@/components/lumen-spark";
import { ScheduledSessionForm } from "@/components/timetable/scheduled-session-form";
import { cancelScheduledSession } from "@/app/(app)/timetable/actions";
import { useSessionStore } from "@/lib/stores/session-store";
import { formatDurationShort } from "@/lib/format";
import type { SubjectOption, TimetableSession } from "@/lib/timetable/types";

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function timeRange(startISO: string, endISO: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const start = new Date(startISO).toLocaleTimeString([], opts);
  const end = new Date(endISO).toLocaleTimeString([], opts);
  return `${start} – ${end}`;
}

const STATUS_BADGE: Record<
  TimetableSession["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PLANNED: { label: "Planned", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "default" },
  MISSED: { label: "Missed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const DOT =
  "relative after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full";

export function TimetableClient({
  sessions,
  subjects,
}: {
  sessions: TimetableSession[];
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const activeSession = useSessionStore((s) => s.active);
  const start = useSessionStore((s) => s.start);

  const [selected, setSelected] = useState<Date>(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableSession | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, TimetableSession[]>();
    for (const s of sessions) {
      const list = map.get(s.plannedLocalDate) ?? [];
      list.push(s);
      map.set(s.plannedLocalDate, list);
    }
    return map;
  }, [sessions]);

  // Calendar markers, colored by the day's overall outcome.
  const markers = useMemo(() => {
    const completed: Date[] = [];
    const missed: Date[] = [];
    const planned: Date[] = [];
    for (const [key, list] of byDate) {
      const d = dateFromKey(key);
      if (list.some((s) => s.status === "MISSED")) missed.push(d);
      else if (list.every((s) => s.status === "COMPLETED")) completed.push(d);
      else planned.push(d);
    }
    return { completed, missed, planned };
  }, [byDate]);

  const selectedKey = dateKey(selected);
  const daySessions = byDate.get(selectedKey) ?? [];
  const completedCount = daySessions.filter((s) => s.status === "COMPLETED").length;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: TimetableSession) {
    setEditing(s);
    setFormOpen(true);
  }

  async function onStart(s: TimetableSession) {
    if (activeSession) {
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

  async function onCancel(id: string) {
    const res = await cancelScheduledSession(id);
    if (res.ok) {
      toast.success("Session cancelled");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground text-sm">
            Plan study sessions and keep your streak going by completing them.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          New session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <LumenSpark className="size-10 opacity-80" />
          <p className="font-medium">No sessions scheduled</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Plan your first study session to build a routine and start earning
            adherence streaks.
          </p>
          <div className="mt-2">
            <Button onClick={openCreate} className="gap-2">
              <CalendarPlus className="size-4" />
              Schedule a session
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card className="w-fit p-3">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              modifiers={markers}
              modifiersClassNames={{
                completed: `${DOT} after:bg-primary`,
                missed: `${DOT} after:bg-destructive`,
                planned: `${DOT} after:bg-muted-foreground`,
              }}
            />
          </Card>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">
                {selected.toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              {daySessions.length > 0 ? (
                <span className="text-muted-foreground text-sm">
                  {completedCount} of {daySessions.length} completed
                </span>
              ) : null}
            </div>

            {daySessions.length === 0 ? (
              <Card className="text-muted-foreground p-6 text-center text-sm">
                Nothing planned for this day.
              </Card>
            ) : (
              daySessions.map((s) => {
                const badge = STATUS_BADGE[s.status];
                const canStart = s.status === "PLANNED" || s.status === "MISSED";
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.title}</span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {timeRange(s.plannedStartISO, s.plannedEndISO)} ·{" "}
                          {formatDurationShort(s.targetDurationSec)}
                        </p>
                        {s.subjectName ? (
                          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                            <span
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor:
                                  s.subjectColor ?? "var(--muted-foreground)",
                              }}
                            />
                            {s.subjectName}
                            {s.topicName ? ` · ${s.topicName}` : ""}
                          </p>
                        ) : null}
                        {s.goal ? (
                          <p className="mt-2 text-sm">{s.goal}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canStart ? (
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => onStart(s)}
                            disabled={Boolean(activeSession)}
                          >
                            <Play className="size-3.5" />
                            Start
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit session"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Cancel session"
                              >
                                <X className="size-4" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &ldquo;{s.title}&rdquo; will be removed from your
                                plan. This can&apos;t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep it</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onCancel(s.id)}>
                                Cancel session
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      <ScheduledSessionForm
        subjects={subjects}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultDateKey={selectedKey}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
