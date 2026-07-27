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
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  Pencil,
  Play,
  Plus,
  X,
} from "lucide-react";
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
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const start = new Date(startISO).toLocaleTimeString([], opts);
  const end = new Date(endISO).toLocaleTimeString([], opts);
  return `${start} – ${end}`;
}

const STATUS_BADGE: Record<
  TimetableSession["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PLANNED: { label: "Planned", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "default" },
  MISSED: { label: "Missed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  ACTIVE: { label: "Active", variant: "default" },
  PARTIAL: { label: "In progress", variant: "outline" },
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
  const searchParams = useSearchParams();
  const activeSession = useSessionStore((s) => s.active);
  const start = useSessionStore((s) => s.start);

  const initialDate = searchParams.get("date");
  const [selected, setSelected] = useState<Date>(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? dateFromKey(initialDate)
      : new Date(),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableSession | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const requestedView = searchParams.get("view");
  const view =
    requestedView === "week" || requestedView === "list"
      ? requestedView
      : "month";

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
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const visibleSessions =
    view === "list"
      ? sessions
      : view === "week"
        ? sessions.filter((session) => {
            const date = dateFromKey(session.plannedLocalDate);
            return date >= weekStart && date < weekEnd;
          })
        : daySessions;
  const completedCount = visibleSessions.filter(
    (s) => s.status === "COMPLETED",
  ).length;

  function replaceQuery(next: { view?: string; date?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.view) params.set("view", next.view);
    if (next.date) params.set("date", next.date);
    router.replace(`/timetable?${params.toString()}`, { scroll: false });
  }

  function moveSelected(days: number) {
    const date = new Date(selected);
    date.setDate(date.getDate() + days);
    setSelected(date);
    replaceQuery({ date: dateKey(date) });
  }

  function openCreate() {
    setEditing(null);
    setFormVersion((value) => value + 1);
    setFormOpen(true);
  }
  function openEdit(s: TimetableSession) {
    setEditing(s);
    setFormVersion((value) => value + 1);
    setFormOpen(true);
  }

  async function onStart(s: TimetableSession) {
    if (activeSession) {
      toast.error("Finish your current session first");
      return;
    }
    const res = await start({ scheduledSessionId: s.id });
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground text-sm">
            Plan study sessions and keep your streak going by completing them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted flex rounded-full p-1">
            {[
              ["month", CalendarDays, "Month"],
              ["week", Columns3, "Week"],
              ["list", List, "List"],
            ].map(([value, Icon, label]) => (
              <Button
                key={String(value)}
                variant={view === value ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                aria-pressed={view === value}
                onClick={() => replaceQuery({ view: String(value) })}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {String(label)}
              </Button>
            ))}
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            New session
          </Button>
        </div>
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
        <div
          className={
            view === "month"
              ? "grid gap-6 lg:grid-cols-[auto_1fr]"
              : "grid gap-6"
          }
        >
          {view === "month" ? (
            <Card className="w-fit p-3">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(date) => {
                  if (!date) return;
                  setSelected(date);
                  replaceQuery({ date: dateKey(date) });
                }}
                modifiers={markers}
                modifiersClassNames={{
                  completed: `${DOT} after:bg-primary`,
                  missed: `${DOT} after:bg-destructive`,
                  planned: `${DOT} after:bg-muted-foreground`,
                }}
              />
            </Card>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">
                {view === "list"
                  ? "All scheduled sessions"
                  : view === "week"
                    ? `Week of ${weekStart.toLocaleDateString([], {
                        month: "long",
                        day: "numeric",
                      })}`
                    : selected.toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
              </h2>
              {visibleSessions.length > 0 ? (
                <span className="text-muted-foreground text-sm">
                  {completedCount} of {visibleSessions.length} completed
                </span>
              ) : null}
              {view === "week" ? (
                <div className="flex gap-1">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Previous week"
                    onClick={() => moveSelected(-7)}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Next week"
                    onClick={() => moveSelected(7)}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>

            {visibleSessions.length === 0 ? (
              <Card className="text-muted-foreground p-6 text-center text-sm">
                {view === "week"
                  ? "Nothing planned for this week."
                  : view === "list"
                    ? "No sessions in this planning window."
                    : "Nothing planned for this day."}
              </Card>
            ) : (
              visibleSessions.map((s) => {
                const badge = STATUS_BADGE[s.status];
                const canStart =
                  s.status === "PLANNED" ||
                  s.status === "MISSED" ||
                  s.status === "PARTIAL";
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
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Planned in {s.planningTimezone}
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
                        {s.actualDurationSec > 0 && s.status !== "COMPLETED" ? (
                          <div className="mt-3 max-w-sm">
                            <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                              <span>
                                {formatDurationShort(s.actualDurationSec)}{" "}
                                across {s.attemptCount}{" "}
                                {s.attemptCount === 1 ? "attempt" : "attempts"}
                              </span>
                              <span>{s.completionPercent}%</span>
                            </div>
                            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${s.completionPercent}%` }}
                              />
                            </div>
                          </div>
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
                            {s.status === "PARTIAL" ? "Continue" : "Start"}
                          </Button>
                        ) : null}
                        {s.canEdit ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Edit session"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        {s.canCancel ? (
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
                                <AlertDialogTitle>
                                  Cancel this session?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  &ldquo;{s.title}&rdquo; will be removed from
                                  your plan. This can&apos;t be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onCancel(s.id)}
                                >
                                  Cancel session
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
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
        key={`${formVersion}:${editing?.id ?? "new"}`}
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
