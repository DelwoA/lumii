// =============================================================================
// FILE: components/timetable/scheduled-session-form.tsx
// WHAT THIS FILE DOES:
//   The form (inside a dialog) for creating or editing a planned study session:
//   subject/topic, date and time, target length, and goal. On submit it calls
//   the timetable create/edit server action. Cancel sits left of the save button.
// =============================================================================
"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createScheduledSession,
  updateScheduledSession,
} from "@/app/(app)/timetable/actions";
import type { SubjectOption, TimetableSession } from "@/lib/timetable/types";

const NONE = "none";

/** Local YYYY-MM-DD for an ISO instant (browser timezone). */
function dateKeyOf(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local HH:MM for an ISO instant (browser timezone). */
function timeKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ScheduledSessionForm({
  subjects,
  open,
  onOpenChange,
  editing,
  defaultDateKey,
  onSaved,
}: {
  subjects: SubjectOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TimetableSession | null;
  defaultDateKey: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [subjectId, setSubjectId] = useState<string>(
    editing?.subjectId ?? NONE,
  );
  const [topicId, setTopicId] = useState<string>(editing?.topicId ?? NONE);
  const [dateStr, setDateStr] = useState(
    editing ? dateKeyOf(editing.plannedStartISO) : defaultDateKey,
  );
  const [startTime, setStartTime] = useState(
    editing ? timeKeyOf(editing.plannedStartISO) : "17:00",
  );
  const [endTime, setEndTime] = useState(
    editing ? timeKeyOf(editing.plannedEndISO) : "18:00",
  );
  const [goal, setGoal] = useState(editing?.goal ?? "");
  const [saving, setSaving] = useState(false);
  const [overlapOpen, setOverlapOpen] = useState(false);

  const topics = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.topics ?? [],
    [subjects, subjectId],
  );

  async function onSubmit(allowOverlap = false) {
    if (!title.trim()) {
      toast.error("Give the session a title");
      return;
    }
    const start = new Date(`${dateStr}T${startTime}`);
    const end = new Date(`${dateStr}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Pick a valid date and time");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after the start time");
      return;
    }

    const payload = {
      title: title.trim(),
      subjectId: subjectId === NONE ? null : subjectId,
      topicId: topicId === NONE ? null : topicId,
      goal: goal.trim() || null,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      allowOverlap,
    };

    setSaving(true);
    const res = editing
      ? await updateScheduledSession(editing.id, payload)
      : await createScheduledSession(payload);
    setSaving(false);

    if (!res.ok) {
      if (res.conflict) {
        setOverlapOpen(true);
        return;
      }
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Session updated" : "Session scheduled");
    onOpenChange(false);
    onSaved();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit session" : "Schedule a session"}
            </SheetTitle>
            <SheetDescription>
              Plan when you&apos;ll study. Completing it keeps your streak
              alive.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label htmlFor="ts-title">Title</Label>
              <Input
                id="ts-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Revise graph algorithms"
              />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v ?? NONE);
                  setTopicId(NONE);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No subject</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {topics.length > 0 ? (
              <div className="space-y-2">
                <Label>Topic</Label>
                <Select
                  value={topicId}
                  onValueChange={(v) => setTopicId(v ?? NONE)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No topic</SelectItem>
                    {topics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="ts-date">Date</Label>
              <Input
                id="ts-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ts-start">Start</Label>
                <Input
                  id="ts-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-end">End</Label>
                <Input
                  id="ts-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ts-goal">Goal (optional)</Label>
              <Textarea
                id="ts-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to get done?"
                rows={2}
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => onSubmit()} disabled={saving}>
              {saving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Schedule session"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={overlapOpen} onOpenChange={setOverlapOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule overlapping sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This time overlaps another plan. You can keep both when the
              overlap is intentional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Adjust the time</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOverlapOpen(false);
                void onSubmit(true);
              }}
            >
              Schedule anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
